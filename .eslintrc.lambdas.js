// ESLint security rules applied to all Lambda handlers.
// Apply with: eslint --config .eslintrc.lambdas.js lambdas/
module.exports = {
  plugins: ["security"],
  extends: ["plugin:security/recommended"],
  rules: {
    "security/detect-child-process": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-unsafe-regex": "error",
  },
};
