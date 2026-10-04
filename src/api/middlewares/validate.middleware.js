// Yengil, tashqi kutubxonasiz request body validatsiyasi.
// rules shakli: { fieldName: { required, type: 'string'|'number'|'boolean', enum: [...] } }
module.exports = function validate(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];
      const isMissing = value === undefined || value === null || value === '';

      if (rule.required && isMissing) {
        errors.push(`${field} majburiy`);
        continue;
      }

      if (isMissing) continue;

      if (rule.type && typeof value !== rule.type) {
        errors.push(`${field} ${rule.type} turida bo'lishi kerak`);
        continue;
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} quyidagilardan biri bo'lishi kerak: ${rule.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validatsiya xatosi', errors });
    }

    next();
  };
};
