/**
 * Mock for better-auth decorators to avoid ES module issues in Jest
 */

export const AllowAnonymous = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    return descriptor;
  };
};

export const Public = AllowAnonymous;
