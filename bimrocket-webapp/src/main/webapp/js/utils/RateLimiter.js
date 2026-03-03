/**
 * RateLimiter.js
 *
 * @author realor
 */

class RateLimiter
{
  constructor(maxPerSecond)
  {
    this.queue = [];
    this.maxPerSecond = maxPerSecond;
    this.timer = null;
    this.running = false;
  }

  start()
  {
    if (this.running) return;

    this.running = true;
    this.timer = setInterval(() =>
    {
      if (!this.running) return;

      for (let i = 0; i < this.maxPerSecond && this.queue.length > 0; i++)
      {
        const task = this.queue.shift();
        task();
      }
    }, 1000);
  }

  stop()
  {
    this.running = false;
    if (this.timer)
    {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  schedule(fn)
  {
    return new Promise((resolve, reject) =>
    {
      this.queue.push(() => fn().then(resolve).catch(reject));
    });
  }
}

export { RateLimiter };
