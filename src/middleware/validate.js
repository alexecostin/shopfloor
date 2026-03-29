export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({
        statusCode: 400,
        error: 'DATE_INVALIDE',
        message: 'Datele trimise sunt invalide.',
        details: messages,
      });
    }

    req.body = value;
    next();
  };
}
