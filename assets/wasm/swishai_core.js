/* @ts-self-types="./swishai_core.d.ts" */

export class WasmEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmengine_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get accuracy() {
        const ret = wasm.wasmengine_accuracy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get basketsMade() {
        const ret = wasm.wasmengine_basketsMade(this.__wbg_ptr);
        return ret;
    }
    /**
     * Sizes the RGBA frame buffer. Reallocating moves it, so JS must re-derive
     * its view afterwards.
     * @param {number} width
     * @param {number} height
     */
    ensure_frame(width, height) {
        wasm.wasmengine_ensure_frame(this.__wbg_ptr, width, height);
    }
    /**
     * Registers every basket still waiting for evidence that will never arrive,
     * returning what that produced as a `StatEvent[]`. Call once the last frame
     * has been processed, before reading the totals.
     * @param {number} frame_idx
     * @returns {any}
     */
    finish(frame_idx) {
        const ret = wasm.wasmengine_finish(this.__wbg_ptr, frame_idx);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {number}
     */
    frame_len() {
        const ret = wasm.wasmengine_frame_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    frame_ptr() {
        const ret = wasm.wasmengine_frame_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * `fps` is the inference rate, `original_fps` the source rate — their ratio
     * scales every pixel constant in the core.
     *
     * `thresholds` is an optional 5-element array in class order
     * (ball, ball-in-basket, player, basket, player-shooting). It is `f64` so a
     * JS number reaches the engine unrounded — an `f32` round-trip moves a
     * threshold slightly below its own value and flips comparisons at the boundary.
     * @param {number} fps
     * @param {number} original_fps
     * @param {Float64Array | null} [thresholds]
     */
    constructor(fps, original_fps, thresholds) {
        var ptr0 = isLikeNone(thresholds) ? 0 : passArrayF64ToWasm0(thresholds, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmengine_new(fps, original_fps, ptr0, len0);
        this.__wbg_ptr = ret;
        WasmEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get shotsAttempted() {
        const ret = wasm.wasmengine_shotsAttempted(this.__wbg_ptr);
        return ret;
    }
    /**
     * `detections` is a flat `[x1, y1, x2, y2, class_idx, conf]` buffer.
     *
     * With `use_frame`, the contents of the buffer behind [`Self::frame_ptr`] are
     * read as this frame's pixels; without it the net-disturbance check abstains.
     * Returns the frame's `FrameState` as a plain JS object.
     * @param {Float32Array} detections
     * @param {number} frame_idx
     * @param {boolean} use_frame
     * @returns {any}
     */
    update(detections, frame_idx, use_frame) {
        const ptr0 = passArrayF32ToWasm0(detections, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmengine_update(this.__wbg_ptr, ptr0, len0, frame_idx, use_frame);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}
if (Symbol.dispose) WasmEngine.prototype[Symbol.dispose] = WasmEngine.prototype.free;

/**
 * RGBA-to-tensor preprocessing and YOLO decode + NMS, kept out of TypeScript.
 *
 * # Why the pointer API
 *
 * `wasm-bindgen` copies `&[u8]` / returned `Vec` arguments across the boundary
 * on every call — ~1.6 MB in for the frame and ~2.8 MB in for the raw head, per
 * inference. That copy is a cost of the binding layer, not of Rust, and it is
 * what erases the win. So the glue owns its buffers, hands JS raw pointers, and
 * JS writes/reads them through TypedArray views over `wasm.memory.buffer`.
 *
 * Growing wasm memory detaches every existing view, so callers must re-derive
 * their views whenever `memory.buffer` changes identity — `nms` returns a `Vec`
 * and that alone can move the heap.
 *
 * # Numeric contract
 *
 * The decode matches what the previous TypeScript path did bit-for-bit, so the
 * annotated output does not shift: score-vs-threshold and argmax compare raw
 * `f32` model outputs (exact in both languages), while everything derived —
 * centre-to-corner conversion, coordinate scaling, IoU areas — runs in `f64` and
 * narrows to `f32` only on write-out, which is JS's native behaviour.
 */
export class WasmGlue {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmGlueFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmglue_free(ptr, 0);
    }
    /**
     * Sizes the output buffer to the model's flattened output length, which is
     * only known once the runtime has produced a result. Reallocating moves the
     * buffer, so JS must re-derive its output view after this returns non-zero.
     * @param {number} len
     */
    ensure_output(len) {
        wasm.wasmglue_ensure_output(this.__wbg_ptr, len);
    }
    /**
     * @param {number} size
     */
    constructor(size) {
        const ret = wasm.wasmglue_new(size);
        this.__wbg_ptr = ret;
        WasmGlueFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Decodes the raw `[1, num_classes + 4, num_anchors]` head in the internal
     * output buffer and runs greedy NMS, per class like the reference's
     * `cv2.dnn.NMSBoxes` loop: a ball and a ball-in-basket box over the same
     * pixels are both kept, and the engine decides between them.
     *
     * `letterbox` is `[scale, pad_x, pad_y, frame_w, frame_h]`: boxes come out
     * in original-frame pixels, clipped to the frame the way the reference
     * clips them before its NMS.
     *
     * Returns a flat `[x1, y1, x2, y2, class_idx, score]` buffer, stride 6 —
     * the exact layout `WasmEngine::update` consumes.
     * @param {number} num_classes
     * @param {number} num_anchors
     * @param {number} conf
     * @param {number} iou
     * @param {Float64Array} letterbox
     * @returns {Float32Array}
     */
    nms(num_classes, num_anchors, conf, iou, letterbox) {
        const ptr0 = passArrayF64ToWasm0(letterbox, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmglue_nms(this.__wbg_ptr, num_classes, num_anchors, conf, iou, ptr0, len0);
        var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * @returns {number}
     */
    output_len() {
        const ret = wasm.wasmglue_output_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Internal raw-model-output buffer — JS copies the runtime's output here before `nms`.
     * @returns {number}
     */
    output_ptr() {
        const ret = wasm.wasmglue_output_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * RGBA -> `[1, 3, size, size]`, channel-planar, scaled to 0..1.
     */
    preprocess_nchw() {
        wasm.wasmglue_preprocess_nchw(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    rgba_len() {
        const ret = wasm.wasmglue_rgba_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Internal RGBA input buffer — JS writes `getImageData` bytes here.
     * @returns {number}
     */
    rgba_ptr() {
        const ret = wasm.wasmglue_rgba_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    tensor_len() {
        const ret = wasm.wasmglue_tensor_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Internal tensor buffer — JS hands a view over this to the inference runtime.
     * @returns {number}
     */
    tensor_ptr() {
        const ret = wasm.wasmglue_tensor_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WasmGlue.prototype[Symbol.dispose] = WasmGlue.prototype.free;

/**
 * What produced a run's events: the core crate's version, since the model ships
 * inside this build and carries none of its own. Stamped on every event so a
 * later reading knows which logic it came from.
 * @returns {string}
 */
export function algorithm_version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.algorithm_version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_92b29b0548f8b746: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_32b398fb48b6d94a: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_da52cf8fe3429cb2: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_8a16b38e4805b298: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./swishai_core_bg.js": import0,
    };
}

const WasmEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmengine_free(ptr, 1));
const WasmGlueFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmglue_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('swishai_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
