import { event, sleep, asyncQueue } from './utils/util'

export default class extends event {

    private sourceBuffer: SourceBuffer

    public q = new asyncQueue([])

    private done: boolean = false;

    constructor(private video: HTMLMediaElement, reader: ReadableStreamDefaultReader, private mediaSource: MediaSource, mimeCodec: string) {
        super()
        const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec)
        let doned = false;
        sourceBuffer.addEventListener('updateend', async (e) => {
            if (doned) {
                return;
            }
            try {
                const { value, done } = await reader.read()
                if (value) {
                    this.push(value)
                }
                if (done) {
                    setTimeout(() => {
                        this.q.push(() => {
                            return new Promise<void>(async (resolve) => {
                                this.done = true;
                                resolve();
                            })
                        })
                    }, 8e3)
                    doned = true
                }
            } catch (e) {
                // 底层出现请求错误,必须终止,显示终止画面
                this.trigger('error', e);
            }

        })
        sourceBuffer.addEventListener('abort', (e) => {
            console.info(e)
        })
        sourceBuffer.addEventListener('error', (e) => {
            console.error(e)
        })
        this.sourceBuffer = sourceBuffer;
    }

    wait() {
        return new Promise<void>(async (resolve) => {
            while (true) {
                if ((this.done && this.update) || this.mediaSource.readyState !== 'open') {
                    return resolve()
                }
                await sleep(5e3)
            }
        })
    }

    get update() {
        if (this.mediaSource.readyState === 'open') {
            return !this.sourceBuffer.updating
        }
        // mediaSource.readyState 已经close,说明上层destroy了,本次任务全部取消
        console.info("mediaSource.readyState status " + this.mediaSource.readyState)
        this.q.clear()
        this.trigger('pause')
        this.done = true;
        return false
    }

    // cachefill 时, done需要重置为false
    repush(data: any) {
        this.done = false
        this.push(data)
    }

    push(data: any) {
        this.q.push(() => {
            return new Promise<void>(async (resolve, reject) => {
                while (true) {
                    try {
                        if (this.done) {
                            // 调用了destroy,则全部任务取消
                            return resolve()
                        }
                        if (this.update) {
                            try {
                                this.sourceBuffer.appendBuffer(data)
                                return resolve();
                            } catch (e) {
                                if (e.name !== 'QuotaExceededError') {
                                    throw e
                                }
                                this.trigger('pause');
                                this.sourceBuffer.remove(0, Math.max(1, this.video.currentTime - 10));
                                await sleep(80);
                                continue;
                            }
                        } else {
                            await sleep(10);
                        }
                    } catch (e) {
                        this.trigger('error', e)
                        return reject(e)
                    }
                }
            })
        })
        return this;
    }
}