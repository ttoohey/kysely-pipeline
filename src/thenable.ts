export function thenable<TObject extends object, TResult>(
  object: TObject,
  asPromise: () => Promise<TResult>,
) {
  return Object.defineProperties(object, {
    then: {
      value(onFulfilled: any, onRejected: any) {
        return asPromise().then(onFulfilled, onRejected);
      },
      configurable: true,
    },
    catch: {
      value(onRejected: any) {
        return asPromise().catch(onRejected);
      },
      configurable: true,
    },
    finally: {
      value(onFinally: any) {
        return asPromise().finally(onFinally);
      },
      configurable: true,
    },
  }) as TObject & Promise<TResult>;
}
