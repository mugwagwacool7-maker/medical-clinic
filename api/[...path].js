module.exports = async (req, res) => {
  const { default: handler } = await import('../client/api/[...path].js');
  return handler(req, res);
};
