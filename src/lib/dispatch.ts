export default class {

    private taskMap: any = {}
    private index: number = 0
    public readonly total: number = 0

    constructor(thunk: number, start: number, end: number) {
        if (!isFinite(start) || !isFinite(end) || start > end) {
            throw new Error("invalid start or end");
        }
        let no = 0
        let x = start
        let last = false
        while (true) {
            const m = x
            let n = m + thunk
            if (n > end) {
                n = end
                last = true
            }
            if (m >= n) {
                break;
            }
            this.taskMap[no] = {
                m,
                n,
                no
            }
            if (last) {
                break;
            }
            x = n
            no++
        }
        this.total = Object.keys(this.taskMap).length
    }

    // 此处需要轮询一遍,查漏
    next() {
        const r = this.taskMap[this.index]
        if (r && !r.done && !(r.start || r.rstart)) {
            this.index++
            r.start = true
            return r
        }
        // 查找跳过的
        for (let i = this.index; i < this.total; i++) {
            const item = this.taskMap[i]
            if (!item.done && !item.start) {
                item.start = true
                this.index = item.no + 1
                return item;
            }
        }
        for (let i = 0; i < this.total; i++) {
            const item = this.taskMap[i]
            if (!item.done && !item.start) {
                item.start = true
                return item;
            }
        }
    }

    // rtc 任务需要比http任务分离遍历,调用方需修改其rstart属性,将0修改为true,代表确实发出查询了
    rtcNext() {
        for (let i = this.index; i < this.total; i++) {
            const item = this.taskMap[i]
            if (!item.done && !item.rstart && !item.start) {
                item.rstart = 0
                return item;
            }
        }
        for (let i = this.index; i < this.total; i++) {
            const item = this.taskMap[i]
            if (!item.done && !item.rstart) {
                item.rstart = 0
                return item;
            }
        }
    }

    getMap() {
        return this.taskMap;
    }

    seekTo(n: number) {
        if (n >= this.total) {
            throw new Error("index error")
        }
        this.index = n;
    }

    done(no: number) {
        if (this.taskMap[no]) {
            this.taskMap[no].done = true
        } else {
            console.error("error in done");
        }
    }

    // 计算从当前http下载点到结尾,有多少rtc已探测并等待结果的
    get rtcWaitCount(): number {
        let num = 0
        for (let i = this.index; i < this.total; i++) {
            const item = this.taskMap[i]
            if (item && !item.done && item.rstart) {
                num++
            }
        }
        return num;
    }

}