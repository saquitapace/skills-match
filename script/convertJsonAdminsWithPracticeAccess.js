console.log('Running convertJsonAdminsWithPracticeAccess.js script to create new Admins DB collection that addd new access.practices field to store a string array of practice/ssa names into MongoDB json format');


if (!process.argv || process.argv.length < 5) {
  console.log(`[ERROR] Missing command parameter(s)
    node convertJsonAdminsWithPracticeAccess.js {SourceAdminsJsonFilePath} {sourcePracticeNamesList} {OutputAdminsJsonFilePath}
  `);
} else {
  const fs = require('fs');
  const sourceAdminsFilePath = process.argv[2];
  const sourcePracticeNamesList = process.argv[3];
  const outputfilePath = process.argv[4];

  console.log(`Reading from source Admins json file: ${sourceAdminsFilePath}`);
  const sourceAdminsJson = require(sourceAdminsFilePath);

  console.log('Successfully read source json file');

  const sourcPracticeNamesArray = sourcePracticeNamesList.split(';');
  if (!sourcPracticeNamesArray || !sourcPracticeNamesArray.length) {
    console.log(`[ERROR] Failed to parse practices(${sourcePracticeNamesList})!`);
    return;
  }

  const mongoDBJsonArray = [];
  // console.log(sourceJson.employees.db1);
  if (outputfilePath) {
    fs.unlink(outputfilePath, () => {});
    console.log(`Saving to file ${outputfilePath}`);
  }

  if (!sourceAdminsFilePath || !sourceAdminsFilePath.length) {
    console.log(`[ERROR] Collection "admins" not found or is empty!`);
  } else {
    const outputAdminsJson = sourceAdminsJson.map(admin => {
      const outputAdmin = JSON.parse(JSON.stringify(admin));
      outputAdmin.access = {
        practices: sourcPracticeNamesArray,
      };
      return outputAdmin;
    });

    // console.log(newSkillGroupsArray);
    if (outputfilePath) {
      outputAdminsJson.forEach(outputAdmin => {
        const jsonString = JSON.stringify(outputAdmin);
        fs.appendFile(outputfilePath, jsonString + '\n\r', (err) => {
          // throws an error, you could also catch it here
          if (err) throw err;

          // success case, the file was saved
          // console.log(`Saved to file ${outputfilePath}`);
        });
      });
    } else {
      console.log(outputAdminsJson);
    }
  }
}
