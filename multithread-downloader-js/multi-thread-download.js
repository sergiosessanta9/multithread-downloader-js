function concatenate(arrays) {
    if (!arrays.length) return null;
    let totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
    let result = new Uint8Array(totalLength);
    let length = 0;
    for (let array of arrays) {
      result.set(array, length);
      length += array.length;
    }
    return result;
  }
  
function getContentLength(url) {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open("HEAD", url);
      
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          const contentRange = xhr.getResponseHeader('Content-Range');
          const fileSize = parseInt(contentRange.split('/')[1]);
          resolve(fileSize);
        } else {
          reject(new Error('Errore durante il recupero delle informazioni sulla dimensione del file.'));
        }
      };
      
      xhr.onerror = function() {
        reject(new Error('Errore di rete durante il recupero delle informazioni sulla dimensione del file.'));
      };
      
      xhr.send();
    });
  }
  
function getBinaryContent(url, start, end, i) {
  return new Promise((resolve, reject) => {
    try {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.setRequestHeader("range", `bytes=${start}-${end}`); // Set range request information
      xhr.setRequestHeader("Access-Control-Allow-Origin", '*');
      xhr.setRequestHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      xhr.setRequestHeader('Access-Control-Allow-Headers', 'Content-Type');
      xhr.responseType = "arraybuffer"; // Set the returned type to arraybuffer
      xhr.onload = function () {
        resolve({
          index: i, // file block index
          buffer: xhr.response,
        });
      };
      xhr.send();
    } catch (err) {
      reject(new Error(err));
    }
  });
}
  
  function saveAs({ name, buffers, mime = "application/octet-stream" }) {
    const blob = new Blob([buffers], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = name || Math.random();
    a.href = blobUrl;
    a.click();
    URL.revokeObjectURL(blob);
  }
  
  async function asyncPool(concurrency, iterable, iteratorFn) {
    const ret = []; // Store all asynchronous tasks
    const executing = new Set(); // Stores executing asynchronous tasks
    for (const item of iterable) {
      // Call the iteratorFn function to create an asynchronous task
      const p = Promise.resolve().then(() => iteratorFn(item, iterable));
      
      ret.push(p); // save new async task
      executing.add(p); // Save an executing asynchronous task
      
      const clean = () => executing.delete(p);
      p.then(clean).catch(clean);
      if (executing.size >= concurrency) {
        // Wait for faster task execution to complete 
        await Promise.race(executing);
      }
    }
    return Promise.all(ret);
  }
  
  async function download({ url, chunkSize, poolLimit = 1 }) {
    const contentLength = await getContentLength(url);
    const chunks =
      typeof chunkSize === "number" ? Math.ceil(contentLength / chunkSize) : 1;
    const results = await asyncPool(
      poolLimit,
      [...new Array(chunks).keys()],
      (i) => {
        let start = i * chunkSize;
        let end = i + 1 == chunks ? contentLength - 1 : (i + 1) * chunkSize - 1;
        return getBinaryContent(url, start, end, i);
      }
    );
    const sortedBuffers = results
      .map((item) => new Uint8Array(item.buffer));
    return concatenate(sortedBuffers);
  }
