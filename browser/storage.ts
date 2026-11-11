const databaseName = `adcrew:${import.meta.env.BASE_URL}:v1`;

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSnapshot(): Promise<Uint8Array | undefined> {
  const database = await open();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('state', 'readonly');
      const request = transaction.objectStore('state').get('database');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

export async function saveSnapshot(data: Uint8Array) {
  const database = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('state', 'readwrite');
      transaction.objectStore('state').put(data, 'database');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Хранилище переполнено.'));
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export function withDatabaseLock<T>(operation: () => Promise<T>) {
  return navigator.locks.request(databaseName, operation);
}
