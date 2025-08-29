// wasm-storage.js - Main wrapper
class WasmStorageWrapper {
    constructor(wasmModule) {
        this.storage = new wasmModule.WasmStorage();
        this.subscriptions = new Map();
        this.subscriptionId = 0;
    }

    // Core API
    setState(key, value) {
        return this.storage.set_state(key, value);
    }

    getState(key) {
        return this.storage.get_state(key);
    }

    getAllState() {
        return this.storage.get_all_state();
    }

    dispatch(actionType, payload = null) {
        return this.storage.dispatch(actionType, payload);
    }

    subscribe(callback) {
        const id = this.subscriptionId++;
        const wasmIndex = this.storage.subscribe(callback);
        this.subscriptions.set(id, wasmIndex);
        return id;
    }

    unsubscribe(id) {
        const wasmIndex = this.subscriptions.get(id);
        if (wasmIndex !== undefined) {
            this.storage.unsubscribe(wasmIndex);
            this.subscriptions.delete(id);
        }
    }

    addMiddleware(middlewareFn) {
        return this.storage.add_middleware(middlewareFn);
    }

    clear() {
        return this.storage.clear_state();
    }

    remove(key) {
        return this.storage.remove_state(key);
    }
}

// Redux Adapter
class ReduxWasmAdapter {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
        this.listeners = new Set();
    }

    createStore(preloadedState = {}) {
        // Initialize with preloaded state
        Object.entries(preloadedState).forEach(([key, value]) => {
            this.wasmStorage.setState(key, value);
        });

        return {
            dispatch: (action) => {
                this.wasmStorage.dispatch(action.type, action.payload || action);
                this.listeners.forEach(listener => listener());
                return action;
            },
            
            getState: () => {
                return this.wasmStorage.getAllState();
            },
            
            subscribe: (listener) => {
                this.listeners.add(listener);
                return () => this.listeners.delete(listener);
            },
            
            replaceReducer: () => {
                // Not applicable for WASM storage
                console.warn('replaceReducer not supported in WASM storage');
            }
        };
    }
}

// Vue/Vuex Adapter
class VuexWasmAdapter {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
        this.mutations = new Map();
        this.actions = new Map();
    }

    createStore(options = {}) {
        const { state = {}, mutations = {}, actions = {} } = options;

        // Initialize state
        Object.entries(state).forEach(([key, value]) => {
            this.wasmStorage.setState(key, value);
        });

        // Register mutations
        Object.entries(mutations).forEach(([type, handler]) => {
            this.mutations.set(type, handler);
        });

        // Register actions
        Object.entries(actions).forEach(([type, handler]) => {
            this.actions.set(type, handler);
        });

        return {
            state: new Proxy({}, {
                get: (target, prop) => {
                    return this.wasmStorage.getState(prop);
                },
                set: (target, prop, value) => {
                    this.wasmStorage.setState(prop, value);
                    return true;
                }
            }),
            
            commit: (type, payload) => {
                const mutation = this.mutations.get(type);
                if (mutation) {
                    const currentState = this.wasmStorage.getAllState();
                    mutation(currentState, payload);
                    // Update WASM storage with modified state
                    Object.entries(currentState).forEach(([key, value]) => {
                        this.wasmStorage.setState(key, value);
                    });
                }
                this.wasmStorage.dispatch(type, payload);
            },
            
            dispatch: async (type, payload) => {
                const action = this.actions.get(type);
                if (action) {
                    const context = {
                        state: this.wasmStorage.getAllState(),
                        commit: (mutationType, mutationPayload) => this.commit(mutationType, mutationPayload),
                        dispatch: (actionType, actionPayload) => this.dispatch(actionType, actionPayload)
                    };
                    return await action(context, payload);
                }
                return this.wasmStorage.dispatch(type, payload);
            },
            
            subscribe: (callback) => {
                return this.wasmStorage.subscribe(callback);
            },
            
            watch: (getter, callback) => {
                let oldValue = getter(this.wasmStorage.getAllState());
                return this.wasmStorage.subscribe(() => {
                    const newValue = getter(this.wasmStorage.getAllState());
                    if (newValue !== oldValue) {
                        callback(newValue, oldValue);
                        oldValue = newValue;
                    }
                });
            }
        };
    }
}

// React Context Provider
class ReactWasmProvider {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
    }

    createContext(React) {
        const WasmStorageContext = React.createContext();

        const WasmStorageProvider = ({ children, initialState = {} }) => {
            const [state, setState] = React.useState(() => {
                // Initialize WASM storage with initial state
                Object.entries(initialState).forEach(([key, value]) => {
                    this.wasmStorage.setState(key, value);
                });
                return this.wasmStorage.getAllState();
            });

            React.useEffect(() => {
                const unsubscribe = this.wasmStorage.subscribe(() => {
                    setState(this.wasmStorage.getAllState());
                });
                return () => unsubscribe;
            }, []);

            const dispatch = React.useCallback((actionType, payload) => {
                this.wasmStorage.dispatch(actionType, payload);
            }, []);

            const contextValue = {
                state,
                dispatch,
                getState: (key) => this.wasmStorage.getState(key),
                setState: (key, value) => this.wasmStorage.setState(key, value)
            };

            return React.createElement(
                WasmStorageContext.Provider,
                { value: contextValue },
                children
            );
        };

        const useWasmStorage = () => {
            const context = React.useContext(WasmStorageContext);
            if (!context) {
                throw new Error('useWasmStorage must be used within WasmStorageProvider');
            }
            return context;
        };

        return { WasmStorageProvider, useWasmStorage, WasmStorageContext };
    }
}

// Solid.js Adapter
class SolidWasmAdapter {
    constructor(wasmStorage) {
        this.wasmStorage = wasmStorage;
    }

    createStore(solid, initialState = {}) {
        const { createSignal, createMemo } = solid;

        // Initialize WASM storage
        Object.entries(initialState).forEach(([key, value]) => {
            this.wasmStorage.setState(key, value);
        });

        const [version, setVersion] = createSignal(0);

        // Subscribe to WASM storage changes
        this.wasmStorage.subscribe(() => {
            setVersion(v => v + 1);
        });

        const store = createMemo(() => {
            version(); // Track signal
            return this.wasmStorage.getAllState();
        });

        const setState = (updater) => {
            if (typeof updater === 'function') {
                const currentState = this.wasmStorage.getAllState();
                const newState = updater(currentState);
                Object.entries(newState).forEach(([key, value]) => {
                    this.wasmStorage.setState(key, value);
                });
            } else {
                Object.entries(updater).forEach(([key, value]) => {
                    this.wasmStorage.setState(key, value);
                });
            }
        };

        return [store, setState];
    }
}

// Angular Service
class AngularWasmService {
    constructor(wasmStorage, angular) {
        this.wasmStorage = wasmStorage;
        this.subject = new angular.BehaviorSubject(this.wasmStorage.getAllState());
        
        // Subscribe to WASM changes and update Angular subject
        this.wasmStorage.subscribe(() => {
            this.subject.next(this.wasmStorage.getAllState());
        });
    }

    getState() {
        return this.subject.asObservable();
    }

    getStateValue() {
        return this.wasmStorage.getAllState();
    }

    dispatch(actionType, payload) {
        this.wasmStorage.dispatch(actionType, payload);
    }

    setState(key, value) {
        this.wasmStorage.setState(key, value);
    }

    select(selector) {
        return this.subject.pipe(
            map(state => selector(state)),
            distinctUntilChanged()
        );
    }
}

// Factory function to create storage with adapters
async function createWasmStorage(wasmModulePath) {
    // Load WASM module
    const wasmModule = await import(wasmModulePath);
    await wasmModule.default();

    const wasmStorage = new WasmStorageWrapper(wasmModule);

    return {
        storage: wasmStorage,
        adapters: {
            redux: new ReduxWasmAdapter(wasmStorage),
            vuex: new VuexWasmAdapter(wasmStorage),
            react: new ReactWasmProvider(wasmStorage),
            solid: new SolidWasmAdapter(wasmStorage),
            angular: (angularDeps) => new AngularWasmService(wasmStorage, angularDeps)
        }
    };
}

export {
    createWasmStorage,
    WasmStorageWrapper,
    ReduxWasmAdapter,
    VuexWasmAdapter,
    ReactWasmProvider,
    SolidWasmAdapter,
    AngularWasmService
};