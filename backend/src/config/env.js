const requiredVariables = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const validateEnv = () => {
  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]?.trim()
  );

  if (missingVariables.length > 0) {
    console.error(
      `Missing required environment variables: ${missingVariables.join(', ')}`
    );

    process.exit(1);
  }
};

export default validateEnv;