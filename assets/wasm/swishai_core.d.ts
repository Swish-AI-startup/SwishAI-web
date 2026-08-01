/* tslint:disable */
/* eslint-disable */

export class WasmEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Sizes the RGBA frame buffer. Reallocating moves it, so JS must re-derive
     * its view afterwards.
     */
    ensure_frame(width: number, height: number): void;
    /**
     * Registers every basket still waiting for evidence that will never arrive.
     * Call once the last frame has been processed, before reading the totals.
     */
    finish(frame_idx: number): void;
    frame_len(): number;
    frame_ptr(): number;
    /**
     * `fps` is the inference rate, `original_fps` the source rate — their ratio
     * scales every pixel constant in the core.
     *
     * `thresholds` is an optional 5-element array in class order
     * (ball, ball-in-basket, player, basket, player-shooting). It is `f64` so a
     * JS number reaches the engine unrounded — an `f32` round-trip moves a
     * threshold slightly below its own value and flips comparisons at the boundary.
     */
    constructor(fps: number, original_fps: number, thresholds?: Float64Array | null);
    /**
     * `detections` is a flat `[x1, y1, x2, y2, class_idx, conf]` buffer.
     *
     * With `use_frame`, the contents of the buffer behind [`Self::frame_ptr`] are
     * read as this frame's pixels; without it the net-disturbance check abstains.
     * Returns the frame's `FrameState` as a plain JS object.
     */
    update(detections: Float32Array, frame_idx: number, use_frame: boolean): any;
    readonly accuracy: number;
    readonly basketsMade: number;
    readonly shotsAttempted: number;
}

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
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Sizes the output buffer to the model's flattened output length, which is
     * only known once the runtime has produced a result. Reallocating moves the
     * buffer, so JS must re-derive its output view after this returns non-zero.
     */
    ensure_output(len: number): void;
    constructor(size: number);
    /**
     * Decodes the raw `[1, num_classes + 4, num_anchors]` head in the internal
     * output buffer and runs greedy NMS.
     *
     * Returns a flat `[x1, y1, x2, y2, class_idx, score]` buffer, stride 6, in
     * original-frame pixels — the exact layout `WasmEngine::update` consumes.
     */
    nms(num_classes: number, num_anchors: number, conf: number, iou: number, scale_x: number, scale_y: number): Float32Array;
    output_len(): number;
    /**
     * Internal raw-model-output buffer — JS copies the runtime's output here before `nms`.
     */
    output_ptr(): number;
    /**
     * RGBA -> `[1, 3, size, size]`, channel-planar, scaled to 0..1.
     */
    preprocess_nchw(): void;
    rgba_len(): number;
    /**
     * Internal RGBA input buffer — JS writes `getImageData` bytes here.
     */
    rgba_ptr(): number;
    tensor_len(): number;
    /**
     * Internal tensor buffer — JS hands a view over this to the inference runtime.
     */
    tensor_ptr(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmengine_free: (a: number, b: number) => void;
    readonly __wbg_wasmglue_free: (a: number, b: number) => void;
    readonly wasmengine_accuracy: (a: number) => number;
    readonly wasmengine_basketsMade: (a: number) => number;
    readonly wasmengine_ensure_frame: (a: number, b: number, c: number) => void;
    readonly wasmengine_finish: (a: number, b: number) => void;
    readonly wasmengine_frame_len: (a: number) => number;
    readonly wasmengine_frame_ptr: (a: number) => number;
    readonly wasmengine_new: (a: number, b: number, c: number, d: number) => number;
    readonly wasmengine_shotsAttempted: (a: number) => number;
    readonly wasmengine_update: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmglue_ensure_output: (a: number, b: number) => void;
    readonly wasmglue_new: (a: number) => number;
    readonly wasmglue_nms: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly wasmglue_output_len: (a: number) => number;
    readonly wasmglue_output_ptr: (a: number) => number;
    readonly wasmglue_preprocess_nchw: (a: number) => void;
    readonly wasmglue_rgba_len: (a: number) => number;
    readonly wasmglue_rgba_ptr: (a: number) => number;
    readonly wasmglue_tensor_len: (a: number) => number;
    readonly wasmglue_tensor_ptr: (a: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
