type ReadJob = { again: boolean; load: (accept: () => boolean) => Promise<void>; promise: Promise<void> }

/** Independent household domains share reads, without losing changes arriving mid-read. */
export function createCoupleReadQueue(current: () => boolean) {
  const jobs = new Map<string, ReadJob>()
  return {
    run(key: string, load: ReadJob['load'], changed = false): Promise<void> {
      if (!current()) return Promise.resolve()
      const previous = jobs.get(key)
      if (previous) {
        if (changed) { previous.again = true; previous.load = load }
        return previous.promise
      }
      const job: ReadJob = { again: false, load, promise: Promise.resolve() }
      jobs.set(key, job)
      const live = () => current() && jobs.get(key) === job
      job.promise = (async () => {
        do { job.again = false; await job.load(() => live() && !job.again) } while (live() && job.again)
      })().finally(() => { if (jobs.get(key) === job) jobs.delete(key) })
      return job.promise
    },
    invalidate(key: string) { const job = jobs.get(key); if (job) job.again = true },
    dispose() { jobs.clear() },
  }
}
