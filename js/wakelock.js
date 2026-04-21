let wakeLock = null;
let refCount = 0;

async function acquire() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch(e) {}
}

export async function acquireWakeLock() {
  refCount++;
  if (!wakeLock) await acquire();
}

export function releaseWakeLock() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Re-acquire when tab becomes visible again (OS releases it on hide)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && refCount > 0 && !wakeLock) {
    await acquire();
  }
});
