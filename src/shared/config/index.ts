import { Enum } from 'enum-plus';

export const PrimaryScopeEnum = Enum({
  Primary: { value: 'primary-provider', label: 'providers.scope.primary' },
  All: { value: 'all-providers', label: 'providers.scope.all' },
});
