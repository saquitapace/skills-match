const addLeadingZeros = (number, size) => {
  let paddedNumber = '' + (number ? number : 0);
  while (paddedNumber.length < size) {
      paddedNumber = '0' + paddedNumber;
  }
  return paddedNumber;
};

module.exports = {
  addLeadingZeros,
};
