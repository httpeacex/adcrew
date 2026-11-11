type BrowserRuntime = {
  post: (url: string, form: FormData, progress: (value: number) => void) => Promise<{ path: string }>;
  navigate: (path: string) => void;
  file: (id: number, preview: boolean) => string;
};

// The server uses HTTP; the Pages build installs browser-local storage.
let runtime: BrowserRuntime | undefined;
export function setBrowserRuntime(value: BrowserRuntime) { runtime = value; }
export function browserRuntime() { return runtime; }
export function fileHref(id: number, preview = false) {
  return runtime?.file(id, preview) ?? `/api/files/${id}${preview ? '?preview=1' : ''}`;
}
