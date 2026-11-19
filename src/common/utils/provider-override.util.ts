import type {
  ClassProvider,
  ExistingProvider,
  FactoryProvider,
  InjectionToken,
  Provider,
  Type,
  ValueProvider,
} from '@nestjs/common';

export type ProviderOverride<T> =
  | T
  | Type<T>
  | Omit<ClassProvider<T>, 'provide'>
  | Omit<ValueProvider<T>, 'provide'>
  | Omit<FactoryProvider<T>, 'provide'>
  | Omit<ExistingProvider<T>, 'provide'>
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

function isProviderObject<T>(
  override: ProviderOverride<T>,
): override is
  | Omit<ClassProvider<T>, 'provide'>
  | Omit<ValueProvider<T>, 'provide'>
  | Omit<FactoryProvider<T>, 'provide'>
  | Omit<ExistingProvider<T>, 'provide'> {
  if (!override || typeof override !== 'object') {
    return false;
  }
  return (
    'useClass' in override ||
    'useValue' in override ||
    'useFactory' in override ||
    'useExisting' in override
  );
}

/**
 * Normalizes a class constructor, value instance, or NestJS Provider object
 * into a concrete Provider bound to `token`.
 */
export function normalizeProviderOverride<T>(
  token: InjectionToken,
  override: ProviderOverride<T>,
): Provider<T> {
  if (isProviderObject(override)) {
    return {
      ...override,
      provide: token,
    } as Provider<T>;
  }

  if (typeof override === 'function') {
    return {
      provide: token,
      useClass: override as Type<T>,
    };
  }

  return {
    provide: token,
    useValue: override,
  };
}
