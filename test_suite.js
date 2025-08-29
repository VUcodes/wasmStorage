// tests/wasm-storage.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWasmStorage } from '../src/wasm-storage.js';

describe('WASM Storage Core', () => {
    let storage;

    beforeEach(async () => {
        const { storage: wasmStorage } = await createWasmStorage('../pkg/wasm_storage.js');
        storage = wasmStorage;
    });

    afterEach(() => {
        storage.clear();
    });

    describe('Basic State Operations', () => {
        it('should set and get state', () => {
            storage.setState('count', 42);
            expect(storage.getState('count')).toBe(42);
        });

        it('should return null for non-existent keys', () => {
            expect(storage.getState('nonexistent')).toBeNull();
        });

        it('should get all state', () => {
            storage.setState('a', 1);
            storage.setState('b', 2);
            
            const state = storage.getAllState();
            expect(state).toEqual({ a: 1, b: 2 });
        });

        it('should clear all state', () => {
            storage.setState('a', 1);
            storage.setState('b', 2);
            storage.clear();
            
            expect(storage.getAllState()).toEqual({});
        });

        it('should remove specific keys', () => {
            storage.setState('a', 1);
            storage.setState('b', 2);
            storage.remove('a');
            
            expect(storage.getAllState()).toEqual({ b: 2 });
        });
    });

    describe('Action Dispatch', () => {
        it('should dispatch actions', () => {
            let receivedAction = null;
            
            storage.addMiddleware((action) => {
                receivedAction = action;
                return action;
            });
            
            storage.dispatch('TEST_ACTION', { data: 'test' });
            
            expect(receivedAction).toEqual({
                type: 'TEST_ACTION',
                payload: { data: 'test' },
                timestamp: expect.any(Number)
            });
        });

        it('should handle built-in actions', () => {
            storage.dispatch('SET_STATE', { count: 5, name: 'test' });
            
            expect(storage.getState('count')).toBe(5);
            expect(storage.getState('name')).toBe('test');
        });
    });

    describe('Subscriptions', () => {
        it('should subscribe to state changes', (done) => {
            const callback = (event) => {
                expect(event.key).toBe('count');
                expect(event.value).toBe(10);
                done();
            };
            
            storage.subscribe(callback);
            storage.setState('count', 10);
        });

        it('should unsubscribe from state changes', () => {
            let callCount = 0;
            const callback = () => callCount++;
            
            const id = storage.subscribe(callback);
            storage.setState('count', 1);
            storage.unsubscribe(id);
            storage.setState('count', 2);
            
            expect(callCount).toBe(1);
        });
    });

    describe('Middleware', () => {
        it('should apply middleware in order', () => {
            const middleware1 = (action) => ({ ...action, middleware1: true });
            const middleware2 = (action) => ({ ...action, middleware2: true });
            
            storage.addMiddleware(middleware1);
            storage.addMiddleware(middleware2);
            
            let finalAction = null;
            storage.addMiddleware((action) => {
                finalAction = action;
                return action;
            });
            
            storage.dispatch('TEST', {});
            
            expect(finalAction.middleware1).toBe(true);
            expect(finalAction.middleware2).toBe(true);
        });

        it('should allow middleware to transform payloads', () => {
            storage.addMiddleware((action) => {
                if (action.type === 'DOUBLE') {
                    return { ...action, payload: action.payload * 2 };
                }
                return action;
            });
            
            storage.dispatch('SET_STATE', { value: 5 });
            storage.dispatch('DOUBLE', 10);
            
            // The DOUBLE action should be transformed but stored as custom action
            expect(storage.getState('__actions_DOUBLE')).toBe(20);
        });
    });
});

// tests/redux-adapter.test.js
describe('Redux Adapter', () => {
    let store;
    let adapters;

    beforeEach(async () => {
        const { storage, adapters: wasmAdapters } = await createWasmStorage('../pkg/wasm_storage.js');
        adapters = wasmAdapters;
        store = adapters.redux.createStore({ count: 0, todos: [] });
    });

    it('should create Redux-compatible store', () => {
        expect(store.dispatch).toBeInstanceOf(Function);
        expect(store.getState).toBeInstanceOf(Function);
        expect(store.subscribe).toBeInstanceOf(Function);
    });

    it('should handle Redux actions', () => {
        store.dispatch({ type: 'INCREMENT', payload: 5 });
        
        // Actions are stored in WASM storage
        const state = store.getState();
        expect(state.__actions_INCREMENT).toBe(5);
    });

    it('should notify subscribers', (done) => {
        const unsubscribe = store.subscribe(() => {
            done();
        });
        
        store.dispatch({ type: 'TEST' });
        unsubscribe();
    });
});

// tests/performance.test.js
describe('Performance Tests', () => {
    let storage;

    beforeEach(async () => {
        const { storage: wasmStorage } = await createWasmStorage('../pkg/wasm_storage.js');
        storage = wasmStorage;
    });

    it('should handle large state objects efficiently', () => {
        const largeObject = {};
        for (let i = 0; i < 10000; i++) {
            largeObject[`key_${i}`] = `value_${i}`;
        }
        
        const startTime = performance.now();
        storage.setState('largeData', largeObject);
        const setStateTime = performance.now() - startTime;
        
        const getStartTime = performance.now();
        const retrieved = storage.getState('largeData');
        const getStateTime = performance.now() - getStartTime;
        
        expect(setStateTime).toBeLessThan(100); // Should be fast
        expect(getStateTime).toBeLessThan(50);
        expect(retrieved).toEqual(largeObject);
    });

    it('should handle rapid state updates', () => {
        const startTime = performance.now();
        
        for (let i = 0; i < 1000; i++) {
            storage.dispatch('INCREMENT', i);
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        expect(totalTime).toBeLessThan(500); // Should handle 1000 updates in < 500ms
    });

    it('should handle many subscribers efficiently', () => {
        const subscribers = [];
        let notificationCount = 0;
        
        // Add 100 subscribers
        for (let i = 0; i < 100; i++) {
            const id = storage.subscribe(() => notificationCount++);
            subscribers.push(id);
        }
        
        const startTime = performance.now();
        storage.setState('test', 'value');
        const endTime = performance.now();
        
        expect(endTime - startTime).toBeLessThan(50);
        expect(notificationCount).toBe(100);
        
        // Cleanup
        subscribers.forEach(id => storage.unsubscribe(id));
    });
});

// tests/framework-adapters.test.js
describe('Framework Adapters', () => {
    let storage, adapters;

    beforeEach(async () => {
        const wasmStorage = await createWasmStorage('../pkg/wasm_storage.js');
        storage = wasmStorage.storage;
        adapters = wasmStorage.adapters;
    });

    describe('Vuex Adapter', () => {
        it('should create Vuex-compatible store', () => {
            const store = adapters.vuex.createStore({
                state: { count: 0 },
                mutations: {
                    INCREMENT(state, payload) {
                        state.count += payload || 1;
                    }
                }
            });

            expect(store.state).toBeDefined();
            expect(store.commit).toBeInstanceOf(Function);
            expect(store.dispatch).toBeInstanceOf(Function);
        });

        it('should handle mutations', () => {
            const store = adapters.vuex.createStore({
                state: { count: 0 },
                mutations: {
                    INCREMENT(state, payload) {
                        state.count += payload || 1;
                    }
                }
            });

            store.commit('INCREMENT', 5);
            expect(store.state.count).toBe(5);
        });

        it('should handle actions', async () => {
            const store = adapters.vuex.createStore({
                state: { count: 0 },
                mutations: {
                    SET_COUNT(state, payload) {
                        state.count = payload;
                    }
                },
                actions: {
                    async setCountAsync({ commit }, value) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                        commit('SET_COUNT', value);
                        return value;
                    }
                }
            });

            const result = await store.dispatch('setCountAsync', 42);
            expect(result).toBe(42);
            expect(store.state.count).toBe(42);
        });
    });

    describe('React Adapter', () => {
        // Mock React hooks
        const mockReact = {
            createContext: () => ({ Provider: null }),
            useContext: () => null,
            useState: (initial) => [initial, () => {}],
            useEffect: () => {},
            useCallback: (fn) => fn,
            createElement: () => null
        };

        it('should create React context', () => {
            const { WasmStorageProvider, useWasmStorage } = 
                adapters.react.createContext(mockReact);

            expect(WasmStorageProvider).toBeDefined();
            expect(useWasmStorage).toBeInstanceOf(Function);
        });
    });

    describe('Solid Adapter', () => {
        // Mock Solid primitives
        const mockSolid = {
            createSignal: (initial) => [() => initial, () => {}],
            createMemo: (fn) => fn
        };

        it('should create Solid store', () => {
            const [store, setState] = adapters.solid.createStore(
                mockSolid, 
                { count: 0 }
            );

            expect(store).toBeInstanceOf(Function);
            expect(setState).toBeInstanceOf(Function);
        });
    });
});

// tests/persistence.test.js
describe('State Persistence', () => {
    let storage;
    
    // Mock localStorage
    const mockLocalStorage = {
        data: {},
        getItem(key) {
            return this.data[key] || null;
        },
        setItem(key, value) {
            this.data[key] = value;
        },
        removeItem(key) {
            delete this.data[key];
        },
        clear() {
            this.data = {};
        }
    };

    beforeEach(async () => {
        global.localStorage = mockLocalStorage;
        mockLocalStorage.clear();
        
        const { storage: wasmStorage } = await createWasmStorage('../pkg/wasm_storage.js');
        storage = wasmStorage;
    });

    it('should persist state to localStorage', async () => {
        const { StatePersistence } = await import('../src/wasm-storage.js');
        
        new StatePersistence(storage, 'test-storage');
        
        storage.setState('count', 42);
        storage.setState('name', 'test');
        
        // Give persistence time to save
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const saved = JSON.parse(localStorage.getItem('test-storage'));
        expect(saved.count).toBe(42);
        expect(saved.name).toBe('test');
    });

    it('should restore state from localStorage', async () => {
        const { StatePersistence } = await import('../src/wasm-storage.js');
        
        // Pre-populate localStorage
        localStorage.setItem('test-storage', JSON.stringify({
            count: 100,
            user: { name: 'John' }
        }));
        
        new StatePersistence(storage, 'test-storage');
        
        expect(storage.getState('count')).toBe(100);
        expect(storage.getState('user')).toEqual({ name: 'John' });
    });
});

// tests/async-actions.test.js
describe('Async Actions', () => {
    let storage, asyncManager;

    beforeEach(async () => {
        const { storage: wasmStorage } = await createWasmStorage('../pkg/wasm_storage.js');
        const { AsyncActionManager } = await import('../src/wasm-storage.js');
        
        storage = wasmStorage;
        asyncManager = new AsyncActionManager(storage);
    });

    it('should handle async actions', async () => {
        // Mock an async operation
        asyncManager.executeAsyncOperation = async (action) => {
            if (action.type === 'FETCH_USER_ASYNC') {
                return { id: action.payload.userId, name: 'John Doe' };
            }
            throw new Error('Unknown action');
        };

        const states = [];
        storage.subscribe(() => {
            states.push(storage.getAllState());
        });

        // Dispatch async action
        storage.dispatch('FETCH_USER_ASYNC', { userId: 123 });

        // Wait for async completion
        await new Promise(resolve => setTimeout(resolve, 50));

        // Should have loading and success states
        expect(states.some(s => s.__actions_FETCH_USER_LOADING)).toBe(true);
        expect(states.some(s => s.__actions_FETCH_USER_SUCCESS)).toBe(true);
    });

    it('should handle async errors', async () => {
        // Mock a failing async operation
        asyncManager.executeAsyncOperation = async () => {
            throw new Error('Network error');
        };

        const states = [];
        storage.subscribe(() => {
            states.push(storage.getAllState());
        });

        storage.dispatch('FETCH_DATA_ASYNC', {});

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(states.some(s => s.__actions_FETCH_DATA_ERROR)).toBe(true);
    });
});

// tests/devtools.test.js
describe('DevTools Integration', () => {
    let storage;

    beforeEach(async () => {
        // Mock Redux DevTools
        global.window = {
            __REDUX_DEVTOOLS_EXTENSION__: {
                connect: () => ({
                    init: () => {},
                    send: () => {},
                    subscribe: () => {}
                })
            }
        };

        const { storage: wasmStorage } = await createWasmStorage('../pkg/wasm_storage.js');
        storage = wasmStorage;
    });

    it('should integrate with Redux DevTools', async () => {
        const { DevToolsIntegration } = await import('../src/wasm-storage.js');
        
        let devToolsCalls = [];
        global.window.__REDUX_DEVTOOLS_EXTENSION__.connect = () => ({
            init: (state) => devToolsCalls.push(['init', state]),
            send: (action, state) => devToolsCalls.push(['send', action, state]),
            subscribe: () => {}
        });

        new DevToolsIntegration(storage);
        
        storage.dispatch('TEST_ACTION', 'test');

        expect(devToolsCalls.length).toBeGreaterThan(0);
        expect(devToolsCalls[0][0]).toBe('init');
    });
});

// Project Structure
const projectStructure = `
wasm-storage/
├── Cargo.toml                 # Rust dependencies and build config
├── src/
│   ├── lib.rs                 # Main Rust WASM module
│   ├── wasm-storage.js        # JavaScript wrapper and adapters
│   └── types.d.ts             # TypeScript definitions
├── tests/
│   ├── wasm-storage.test.js   # Core functionality tests
│   ├── redux-adapter.test.js  # Redux adapter tests
│   ├── performance.test.js    # Performance benchmarks
│   ├── framework-adapters.test.js # Framework adapter tests
│   ├── persistence.test.js    # State persistence tests
│   ├── async-actions.test.js  # Async action tests
│   └── devtools.test.js       # DevTools integration tests
├── examples/
│   ├── react-example/         # React integration example
│   ├── vue-example/           # Vue.js integration example
│   ├── angular-example/       # Angular integration example
│   ├── solid-example/         # Solid.js integration example
│   └── vanilla-example/       # Vanilla JS example
├── benchmarks/
│   ├── vs-redux.js           # Performance comparison with Redux
│   ├── vs-vuex.js            # Performance comparison with Vuex
│   └── memory-usage.js       # Memory usage benchmarks
├── pkg/                      # Generated WASM output (after build)
├── docs/                     # Documentation
│   ├── api.md               # API reference
│   ├── examples.md          # Usage examples
│   └── migration.md         # Migration guide
├── package.json             # Node.js package configuration
├── README.md               # Project overview and quick start
├── LICENSE                 # MIT license
└── .github/
    └── workflows/
        └── ci.yml          # Continuous integration
`;

// Benchmark Example
const benchmarkExample = `
// benchmarks/vs-redux.js - Performance comparison
import { createWasmStorage } from '../src/wasm-storage.js';
import { createStore } from 'redux';

async function runBenchmarks() {
    console.log('=== WASM Storage vs Redux Performance Comparison ===\\n');
    
    // Setup WASM Storage
    const { storage: wasmStorage, adapters } = await createWasmStorage('../pkg/wasm_storage.js');
    const wasmReduxStore = adapters.redux.createStore({ count: 0 });
    
    // Setup Redux
    const reduxStore = createStore((state = { count: 0 }, action) => {
        switch (action.type) {
            case 'INCREMENT':
                return { ...state, count: state.count + (action.payload || 1) };
            default:
                return state;
        }
    });
    
    const iterations = 10000;
    
    // Benchmark: State Updates
    console.log(\`Testing \${iterations} state updates...\`);
    
    // WASM Storage
    const wasmStart = performance.now();
    for (let i = 0; i < iterations; i++) {
        wasmReduxStore.dispatch({ type: 'INCREMENT', payload: 1 });
    }
    const wasmTime = performance.now() - wasmStart;
    
    // Redux
    const reduxStart = performance.now();
    for (let i = 0; i < iterations; i++) {
        reduxStore.dispatch({ type: 'INCREMENT', payload: 1 });
    }
    const reduxTime = performance.now() - reduxStart;
    
    console.log(\`WASM Storage: \${wasmTime.toFixed(2)}ms\`);
    console.log(\`Redux: \${reduxTime.toFixed(2)}ms\`);
    console.log(\`WASM is \${(reduxTime / wasmTime).toFixed(2)}x faster\\n\`);
    
    // Benchmark: Large State Objects
    console.log('Testing large state object serialization...');
    
    const largeObject = {};
    for (let i = 0; i < 5000; i++) {
        largeObject[\`item_\${i}\`] = { id: i, name: \`Item \${i}\`, active: i % 2 === 0 };
    }
    
    // WASM Storage
    const wasmSerialStart = performance.now();
    wasmStorage.setState('largeData', largeObject);
    const retrieved = wasmStorage.getState('largeData');
    const wasmSerialTime = performance.now() - wasmSerialStart;
    
    // Redux (using JSON serialization)
    const reduxSerialStart = performance.now();
    const serialized = JSON.stringify(largeObject);
    const deserialized = JSON.parse(serialized);
    const reduxSerialTime = performance.now() - reduxSerialStart;
    
    console.log(\`WASM Storage: \${wasmSerialTime.toFixed(2)}ms\`);
    console.log(\`JSON stringify/parse: \${reduxSerialTime.toFixed(2)}ms\`);
    console.log(\`WASM is \${(reduxSerialTime / wasmSerialTime).toFixed(2)}x faster\\n\`);
    
    // Memory usage comparison would require additional tooling
    console.log('Memory usage comparison requires browser dev tools or Node.js --inspect');
}

if (typeof module !== 'undefined') {
    module.exports = runBenchmarks;
} else {
    runBenchmarks();
}
`;

// CI Configuration
const ciConfig = `
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        target: wasm32-unknown-unknown
        
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install wasm-pack
      run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
      
    - name: Install dependencies
      run: npm install
      
    - name: Build WASM module
      run: npm run build:wasm
      
    - name: Run tests
      run: npm test
      
    - name: Run benchmarks
      run: npm run bench
      
    - name: Check formatting
      run: cargo fmt -- --check
      
    - name: Run Clippy
      run: cargo clippy -- -D warnings

  publish:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')
    
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        registry-url: 'https://registry.npmjs.org'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build for production
      run: npm run build:optimized
      
    - name: Publish to NPM
      run: npm publish
      env:
        NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;

export {
    projectStructure,
    benchmarkExample,
    ciConfig
};