console.log('Running convertJsonFirebaseToMongoDB.js script to convert from Firebase exported json data file into new MongoDB json format');


if (!process.argv || process.argv.length < 5) {
  console.log(`[ERROR] Missing command parameter(s)
    node convertJsonFirebaseToMongoDB.js {SourceJsonFilePath} {OutputJsonFilePath} {CollectionName}
  `);
} else {
  const fs = require('fs');
  const sourcefilePath = process.argv[2];
  const outputfilePath = process.argv[3];
  const collectionName = process.argv[4];

  console.log(`Reading from Firebase json file: ${sourcefilePath}`);
  const firebaseJson = require(sourcefilePath);

  console.log('Successfully read source json file');
  const mongoDBJsonArray = [];
  // console.log(firebaseJson.employees.db1);
  if (outputfilePath) {
    fs.unlink(outputfilePath, () => {});
    console.log(`Saving to file ${outputfilePath}`);
  }

  let collectionObject;
  if (collectionName === 'employees') {
    collectionObject = firebaseJson.employees.db1;
  } else {
    collectionObject = firebaseJson[collectionName];
  }

  if (!collectionObject) {
    console.log(`[ERROR] Collection named ${collectionName} not found!`);
  } else {
    for(const key in collectionObject) {
      const jsonString = JSON.stringify(collectionObject[key]);
      if (outputfilePath) {
        fs.appendFile(outputfilePath, jsonString, (err) => {
          // throws an error, you could also catch it here
          if (err) throw err;

          // success case, the file was saved
          // console.log(`Saved to file ${outputfilePath}`);
        });
      } else {
        console.log(jsonString);
      }
    }
  }
}
