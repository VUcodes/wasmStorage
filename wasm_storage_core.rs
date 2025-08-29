use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// Enable logging for debugging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageEvent {
    pub action_type: String,
    pub payload: JsValue,
    pub timestamp: f64,
}

#[wasm_bindgen]
pub struct WasmStorage {
    state: Arc<Mutex<HashMap<String, JsValue>>>,
    listeners: Arc<Mutex<Vec<js_sys::Function>>>,
    middleware: Arc<Mutex<Vec<js_sys::Function>>>,
}

#[wasm_bindgen]
impl WasmStorage {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmStorage {
        console_log!("WasmStorage initialized");
        WasmStorage {
            state: Arc::new(Mutex::new(HashMap::new())),
            listeners: Arc::new(Mutex::new(Vec::new())),
            middleware: Arc::new(Mutex::new(Vec::new())),
        }
    }

    #[wasm_bindgen]
    pub fn set_state(&mut self, key: &str, value: JsValue) -> Result<(), JsValue> {
        let mut state = self.state.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        state.insert(key.to_string(), value.clone());
        
        // Notify listeners
        self.notify_listeners(key, &value)?;
        
        Ok(())
    }

    #[wasm_bindgen]
    pub fn get_state(&self, key: &str) -> Result<JsValue, JsValue> {
        let state = self.state.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(state.get(key).cloned().unwrap_or(JsValue::NULL))
    }

    #[wasm_bindgen]
    pub fn get_all_state(&self) -> Result<JsValue, JsValue> {
        let state = self.state.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let js_object = js_sys::Object::new();
        
        for (key, value) in state.iter() {
            js_sys::Reflect::set(&js_object, &JsValue::from_str(key), value)?;
        }
        
        Ok(js_object.into())
    }

    #[wasm_bindgen]
    pub fn dispatch(&mut self, action_type: &str, payload: JsValue) -> Result<(), JsValue> {
        let timestamp = js_sys::Date::now();
        
        // Apply middleware
        let processed_payload = self.apply_middleware(action_type, payload, timestamp)?;
        
        // Create storage event
        let event = StorageEvent {
            action_type: action_type.to_string(),
            payload: processed_payload.clone(),
            timestamp,
        };
        
        // Update state based on action type
        self.handle_action(&event)?;
        
        console_log!("Action dispatched: {} at {}", action_type, timestamp);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn subscribe(&mut self, callback: js_sys::Function) -> Result<u32, JsValue> {
        let mut listeners = self.listeners.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        listeners.push(callback);
        Ok((listeners.len() - 1) as u32)
    }

    #[wasm_bindgen]
    pub fn unsubscribe(&mut self, index: u32) -> Result<(), JsValue> {
        let mut listeners = self.listeners.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if (index as usize) < listeners.len() {
            listeners.remove(index as usize);
        }
        Ok(())
    }

    #[wasm_bindgen]
    pub fn add_middleware(&mut self, middleware_fn: js_sys::Function) -> Result<(), JsValue> {
        let mut middleware = self.middleware.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        middleware.push(middleware_fn);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn clear_state(&mut self) -> Result<(), JsValue> {
        let mut state = self.state.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        state.clear();
        console_log!("State cleared");
        Ok(())
    }

    #[wasm_bindgen]
    pub fn remove_state(&mut self, key: &str) -> Result<(), JsValue> {
        let mut state = self.state.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        state.remove(key);
        self.notify_listeners(key, &JsValue::NULL)?;
        Ok(())
    }

    // Private helper methods
    fn notify_listeners(&self, key: &str, value: &JsValue) -> Result<(), JsValue> {
        let listeners = self.listeners.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let change_event = js_sys::Object::new();
        js_sys::Reflect::set(&change_event, &JsValue::from_str("key"), &JsValue::from_str(key))?;
        js_sys::Reflect::set(&change_event, &JsValue::from_str("value"), value)?;
        js_sys::Reflect::set(&change_event, &JsValue::from_str("timestamp"), &JsValue::from_f64(js_sys::Date::now()))?;
        
        for listener in listeners.iter() {
            let _ = listener.call1(&JsValue::NULL, &change_event);
        }
        
        Ok(())
    }

    fn apply_middleware(&self, action_type: &str, payload: JsValue, timestamp: f64) -> Result<JsValue, JsValue> {
        let middleware = self.middleware.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut current_payload = payload;
        
        for middleware_fn in middleware.iter() {
            let action_obj = js_sys::Object::new();
            js_sys::Reflect::set(&action_obj, &JsValue::from_str("type"), &JsValue::from_str(action_type))?;
            js_sys::Reflect::set(&action_obj, &JsValue::from_str("payload"), &current_payload)?;
            js_sys::Reflect::set(&action_obj, &JsValue::from_str("timestamp"), &JsValue::from_f64(timestamp))?;
            
            let result = middleware_fn.call1(&JsValue::NULL, &action_obj)?;
            if !result.is_undefined() && !result.is_null() {
                current_payload = js_sys::Reflect::get(&result, &JsValue::from_str("payload"))?;
            }
        }
        
        Ok(current_payload)
    }

    fn handle_action(&mut self, event: &StorageEvent) -> Result<(), JsValue> {
        match event.action_type.as_str() {
            "SET_STATE" => {
                if let Ok(obj) = js_sys::Object::try_from(&event.payload) {
                    let entries = js_sys::Object::entries(&obj);
                    for i in 0..entries.length() {
                        let entry = entries.get(i);
                        let key_value = js_sys::Array::from(&entry);
                        let key = key_value.get(0).as_string().unwrap_or_default();
                        let value = key_value.get(1);
                        self.set_state(&key, value)?;
                    }
                }
            }
            "REMOVE_STATE" => {
                if let Some(key) = event.payload.as_string() {
                    self.remove_state(&key)?;
                }
            }
            "CLEAR_STATE" => {
                self.clear_state()?;
            }
            _ => {
                // Custom actions - store in a special actions state
                let mut state = self.state.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
                let actions_key = format!("__actions_{}", event.action_type);
                state.insert(actions_key, event.payload.clone());
            }
        }
        Ok(())
    }
}

// Export the module
#[wasm_bindgen(start)]
pub fn main() {
    console_log!("WASM Storage module loaded");
}