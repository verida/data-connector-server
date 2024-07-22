
# Notes

`pdf-parse` is used to convert PDF files to text so their contents can be searched. There is a bug in the library that causes this message to be output to the console when fonts can't be found: `Warning: TT: undefined function: 32` (see https://github.com/mozilla/pdf.js/issues/3768#issuecomment-36468349)