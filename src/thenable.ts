export function thenable<TObject extends object, TResult>(
  object: TObject,
  asPromise: () => Promise<TResult>,
) {
  return Object.defineProperties(object, {
    then: {
      get() {
        const p = asPromise();
        return p.then.bind(p);
      },
      configurable: true,
    },
    catch: {
      get() {
        const p = asPromise();
        return p.catch.bind(p);
      },
      configurable: true,
    },
    finally: {
      get() {
        const p = asPromise();
        return p.finally.bind(p);
      },
      configurable: true,
    },
  }) as TObject & Promise<TResult>;
}
