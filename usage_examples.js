// Usage Examples for Different Frameworks

// 1. React Usage
import React from 'react';
import { createWasmStorage } from './wasm-storage.js';

async function setupReactApp() {
    const { storage, adapters } = await createWasmStorage('./pkg/wasm_storage.js');
    
    // Create React context provider
    const { WasmStorageProvider, useWasmStorage } = adapters.react.createContext(React);
    
    function CounterComponent() {
        const { state, dispatch, getState } = useWasmStorage();
        const count = getState('count') || 0;
        
        return (
            <div>
                <p>Count: {count}</p>
                <button onClick={() => dispatch('INCREMENT', 1)}>+</button>
                <button onClick={() => dispatch('DECREMENT', 1)}>-</button>
            </div>
        );
    }
    
    function App() {
        return (
            <WasmStorageProvider initialState={{ count: 0 }}>
                <CounterComponent />
            </WasmStorageProvider>
        );
    }
    
    return App;
}

// 2. Vue.js/Vuex Usage
import { createApp } from 'vue';
import { createWasmStorage } from './wasm-storage.js';

async function setupVueApp() {
    const { storage, adapters } = await createWasmStorage('./pkg/wasm_storage.js');
    
    const store = adapters.vuex.createStore({
        state: {
            count: 0,
            todos: []
        },
        mutations: {
            INCREMENT(state, payload) {
                state.count += payload || 1;
            },
            DECREMENT(state, payload) {
                state.count -= payload || 1;
            },
            ADD_TODO(state, todo) {
                state.todos.push(todo);
            }
        },
        actions: {
            async incrementAsync({ commit }, amount) {
                setTimeout(() => {
                    commit('INCREMENT', amount);
                }, 1000);
            }
        }
    });
    
    const app = createApp({
        computed: {
            count() {
                return this.$store.state.count;
            }
        },
        methods: {
            increment() {
                this.$store.commit('INCREMENT', 1);
            },
            decrement() {
                this.$store.commit('DECREMENT', 1);
            },
            incrementAsync() {
                this.$store.dispatch('incrementAsync', 5);
            }
        },
        template: `
            <div>
                <p>Count: {{ count }}</p>
                <button @click="increment">+</button>
                <button @click="decrement">-</button>
                <button @click="incrementAsync">+5 (Async)</button>
            </div>
        `
    });
    
    app.use(store);
    return app;
}

// 3. Redux Usage
import { createWasmStorage } from './wasm-storage.js';

async function setupReduxApp() {
    const { storage, adapters } = await createWasmStorage('./pkg/wasm_storage.js');
    
    const store = adapters.redux.createStore({
        count: 0,
        user: null
    });
    
    // Middleware example
    storage.addMiddleware((action) => {
        console.log('Action dispatched:', action);
        
        // Modify action if needed
        if (action.type === 'INCREMENT') {
            return {
                ...action,
                payload: action.payload * 2 // Double the increment
            };
        }
        
        return action;
    });
    
    // Usage
    store.dispatch({ type: 'INCREMENT', payload: 1 });
    console.log('Current state:', store.getState());
    
    const unsubscribe = store.subscribe(() => {
        console.log('State changed:', store.getState());
    });
    
    return { store, unsubscribe };
}

// 4. Solid.js Usage
import { render } from 'solid-js/web';
import { createSignal, createMemo } from 'solid-js';
import { createWasmStorage } from './wasm-storage.js';

async function setupSolidApp() {
    const { storage, adapters } = await createWasmStorage('./pkg/wasm_storage.js');
    
    function CounterApp() {
        const [store, setStore] = adapters.solid.createStore(
            { createSignal, createMemo },
            { count: 0 }
        );
        
        const increment = () => {
            setStore(state => ({ ...state, count: state.count + 1 }));
        };
        
        const decrement = () => {
            setStore(state => ({ ...state, count: state.count - 1 }));
        };
        
        return (
            <div>
                <p>Count: {store().count}</p>
                <button onClick={increment}>+</button>
                <button onClick={decrement}>-</button>
            </div>
        );
    }
    
    render(() => <CounterApp />, document.getElementById('app'));
}

// 5. Angular Usage
import { Injectable, Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { createWasmStorage } from './wasm-storage.js';

@Injectable({ providedIn: 'root' })
class WasmStorageService {
    private wasmService;
    
    async init() {
        const { storage, adapters } = await createWasmStorage('./pkg/wasm_storage.js');
        this.wasmService = adapters.angular({ BehaviorSubject, map, distinctUntilChanged });
        return this.wasmService;
    }
    
    getState() {
        return this.wasmService?.getState();
    }
    
    dispatch(actionType, payload) {
        return this.wasmService?.dispatch(actionType, payload);
    }
    
    select(selector) {
        return this.wasmService?.select(selector);
    }
}

@Component({
    selector: 'app-counter',
    template: `
        <div>
            <p>Count: {{ count$ | async }}</p>
            <button (click)="increment()">+</button>
            <button (click)="decrement()">-</button>
        </div>
    `
})
class CounterComponent {
    count$ = this.wasmStorage.select(state => state.count || 0);
    
    constructor(private wasmStorage: WasmStorageService) {}
    
    increment() {
        this.wasmStorage.dispatch('INCREMENT', 1);
    }
    
    decrement() {
        this.wasmStorage.dispatch('DECREMENT', 1);
    }
}

// 6. Vanilla JavaScript Usage
async function setupVanillaApp() {
    const { storage } = await createWasmStorage('./pkg/wasm_storage.js');
    
    // Set initial state
    storage.setState('count', 0);
    storage.setState('user', { name: 'John', email: 'john@example.com' });
    
    // Add middleware for logging
    storage.addMiddleware((action) => {
        console.log(`[${new Date().toISOString()}] ${action.type}:`, action.payload);
        return action;
    });
    
    // Subscribe to changes
    const unsubscribe = storage.subscribe((event) => {
        console.log('State changed:', event);
        updateUI();
    });
    
    // Dispatch actions
    storage.dispatch('INCREMENT', 5);
    storage.dispatch('SET_USER_NAME', 'Jane Doe');
    
    function updateUI() {
        const state = storage.getAllState();
        document.getElementById('count').textContent = state.count;
        document.getElementById('user').textContent = JSON.stringify(state.user);
    }
    
    return { storage, unsubscribe };
}

// Build Script (package.json scripts)
const buildScripts = {
    "scripts": {
        "build:wasm": "wasm-pack build --target web --out-dir pkg",
        "build:optimized": "wasm-pack build --target web --out-dir pkg --release",
        "dev": "wasm-pack build --target web --out-dir pkg --dev",
        "test": "wasm-pack test --headless --firefox",
        "clean": "rm -rf pkg/"
    },
    "devDependencies": {
        "wasm-pack": "^0.12.1"
    }
};

// Advanced Features and Optimizations

// 7. Performance Monitoring
class PerformanceMonitor {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
        this.metrics = {
            actionCount: 0,
            averageDispatchTime: 0,
            stateSize: 0
        };
        
        this.setupMonitoring();
    }
    
    setupMonitoring() {
        this.wasmStorage.addMiddleware((action) => {
            const startTime = performance.now();
            
            // Process action
            const result = action;
            
            // Update metrics
            const endTime = performance.now();
            const dispatchTime = endTime - startTime;
            
            this.metrics.actionCount++;
            this.metrics.averageDispatchTime = 
                (this.metrics.averageDispatchTime + dispatchTime) / 2;
            
            // Calculate state size
            const state = this.wasmStorage.getAllState();
            this.metrics.stateSize = JSON.stringify(state).length;
            
            console.log('Performance Metrics:', this.metrics);
            return result;
        });
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
}

// 8. State Persistence
class StatePersistence {
    constructor(wasmStorage, storageKey = 'wasm-storage-state') {
        this.wasmStorage = wasmStorage;
        this.storageKey = storageKey;
        this.setupPersistence();
    }
    
    setupPersistence() {
        // Load initial state from localStorage
        this.loadState();
        
        // Save state on changes
        this.wasmStorage.subscribe(() => {
            this.saveState();
        });
    }
    
    saveState() {
        try {
            const state = this.wasmStorage.getAllState();
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save state:', error);
        }
    }
    
    loadState() {
        try {
            const savedState = localStorage.getItem(this.storageKey);
            if (savedState) {
                const state = JSON.parse(savedState);
                Object.entries(state).forEach(([key, value]) => {
                    this.wasmStorage.setState(key, value);
                });
            }
        } catch (error) {
            console.warn('Failed to load state:', error);
        }
    }
    
    clearPersistence() {
        localStorage.removeItem(this.storageKey);
    }
}

// 9. DevTools Integration
class DevToolsIntegration {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
        this.actionHistory = [];
        this.currentIndex = -1;
        this.setupDevTools();
    }
    
    setupDevTools() {
        // Connect to Redux DevTools if available
        if (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION__) {
            this.devTools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
                name: 'WASM Storage'
            });
            
            this.devTools.init(this.wasmStorage.getAllState());
            
            // Subscribe to WASM storage changes
            this.wasmStorage.addMiddleware((action) => {
                this.actionHistory.push(action);
                this.currentIndex = this.actionHistory.length - 1;
                
                this.devTools.send(action, this.wasmStorage.getAllState());
                return action;
            });
            
            // Handle time travel debugging
            this.devTools.subscribe((message) => {
                if (message.type === 'DISPATCH') {
                    this.handleTimeTravel(message.payload);
                }
            });
        }
    }
    
    handleTimeTravel(payload) {
        switch (payload.type) {
            case 'RESET':
                this.wasmStorage.clear();
                this.actionHistory = [];
                this.currentIndex = -1;
                break;
                
            case 'COMMIT':
                this.actionHistory = [];
                this.currentIndex = -1;
                break;
                
            case 'JUMP_TO_ACTION':
            case 'JUMP_TO_STATE':
                // Replay actions up to the selected point
                this.replayActions(payload.actionId);
                break;
        }
    }
    
    replayActions(targetIndex) {
        this.wasmStorage.clear();
        for (let i = 0; i <= targetIndex && i < this.actionHistory.length; i++) {
            const action = this.actionHistory[i];
            this.wasmStorage.dispatch(action.type, action.payload);
        }
        this.currentIndex = targetIndex;
    }
}

// 10. Async Actions Support
class AsyncActionManager {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
        this.pendingActions = new Map();
        this.setupAsyncSupport();
    }
    
    setupAsyncSupport() {
        this.wasmStorage.addMiddleware((action) => {
            // Handle async actions
            if (action.type.endsWith('_ASYNC')) {
                this.handleAsyncAction(action);
                return null; // Don't process immediately
            }
            
            return action;
        });
    }
    
    async handleAsyncAction(action) {
        const baseType = action.type.replace('_ASYNC', '');
        const requestId = `${baseType}_${Date.now()}`;
        
        // Dispatch loading state
        this.wasmStorage.dispatch(`${baseType}_LOADING`, { requestId });
        this.pendingActions.set(requestId, action);
        
        try {
            // Execute async operation
            const result = await this.executeAsyncOperation(action);
            
            // Dispatch success
            this.wasmStorage.dispatch(`${baseType}_SUCCESS`, { 
                requestId, 
                result,
                originalPayload: action.payload 
            });
        } catch (error) {
            // Dispatch error
            this.wasmStorage.dispatch(`${baseType}_ERROR`, { 
                requestId, 
                error: error.message,
                originalPayload: action.payload 
            });
        } finally {
            this.pendingActions.delete(requestId);
        }
    }
    
    async executeAsyncOperation(action) {
        // This would be customized based on the action type
        switch (action.type) {
            case 'FETCH_USER_ASYNC':
                const response = await fetch(`/api/users/${action.payload.userId}`);
                return await response.json();
                
            case 'SAVE_DATA_ASYNC':
                const saveResponse = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(action.payload)
                });
                return await saveResponse.json();
                
            default:
                throw new Error(`Unknown async action: ${action.type}`);
        }
    }
    
    getPendingActions() {
        return Array.from(this.pendingActions.values());
    }
}

// 11. Type Safety (TypeScript definitions)
const typeScriptDefinitions = `
// wasm-storage.d.ts
export interface WasmStorageAction {
    type: string;
    payload?: any;
    timestamp?: number;
}

export interface WasmStorageEvent {
    key: string;
    value: any;
    timestamp: number;
}

export interface WasmStorageState {
    [key: string]: any;
}

export interface WasmStorageSubscription {
    unsubscribe(): void;
}

export interface WasmStorageMiddleware {
    (action: WasmStorageAction): WasmStorageAction | null;
}

export class WasmStorageWrapper {
    setState(key: string, value: any): void;
    getState(key: string): any;
    getAllState(): WasmStorageState;
    dispatch(actionType: string, payload?: any): void;
    subscribe(callback: (event: WasmStorageEvent) => void): number;
    unsubscribe(id: number): void;
    addMiddleware(middleware: WasmStorageMiddleware): void;
    clear(): void;
    remove(key: string): void;
}

export interface ReduxCompatibleStore {
    dispatch(action: WasmStorageAction): WasmStorageAction;
    getState(): WasmStorageState;
    subscribe(listener: () => void): () => void;
}

export interface VuexCompatibleStore {
    state: WasmStorageState;
    commit(type: string, payload?: any): void;
    dispatch(type: string, payload?: any): Promise<any>;
    subscribe(callback: (event: WasmStorageEvent) => void): number;
    watch<T>(getter: (state: WasmStorageState) => T, callback: (newValue: T, oldValue: T) => void): number;
}
`;

// 12. Testing Utilities
class WasmStorageTestUtils {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
        this.snapshots = [];
        this.actionLog = [];
    }
    
    // Create a snapshot of current state
    createSnapshot() {
        const state = this.wasmStorage.getAllState();
        this.snapshots.push(JSON.parse(JSON.stringify(state)));
        return this.snapshots.length - 1;
    }
    
    // Restore state from snapshot
    restoreSnapshot(index) {
        if (index >= 0 && index < this.snapshots.length) {
            const snapshot = this.snapshots[index];
            this.wasmStorage.clear();
            Object.entries(snapshot).forEach(([key, value]) => {
                this.wasmStorage.setState(key, value);
            });
        }
    }
    
    // Record actions for replay
    startRecording() {
        this.actionLog = [];
        return this.wasmStorage.addMiddleware((action) => {
            this.actionLog.push({ ...action, timestamp: Date.now() });
            return action;
        });
    }
    
    // Replay recorded actions
    replay(speed = 1) {
        return new Promise((resolve) => {
            let index = 0;
            const replayNext = () => {
                if (index < this.actionLog.length) {
                    const action = this.actionLog[index];
                    this.wasmStorage.dispatch(action.type, action.payload);
                    index++;
                    setTimeout(replayNext, 100 / speed);
                } else {
                    resolve();
                }
            };
            replayNext();
        });
    }
    
    // Generate test fixtures
    generateTestData() {
        return {
            users: [
                { id: 1, name: 'John Doe', email: 'john@example.com' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
            ],
            posts: [
                { id: 1, title: 'Hello World', content: 'First post', userId: 1 },
                { id: 2, title: 'WASM is awesome', content: 'Second post', userId: 2 }
            ],
            settings: {
                theme: 'dark',
                language: 'en',
                notifications: true
            }
        };
    }
}

export {
    PerformanceMonitor,
    StatePersistence,
    DevToolsIntegration,
    AsyncActionManager,
    WasmStorageTestUtils,
    typeScriptDefinitions
};