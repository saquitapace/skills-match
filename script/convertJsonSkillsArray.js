console.log('Running convertJsonSkillsArray.js script to create new skills collection DB (Object array, with "hot" boolean field added) from old skill group collection in MongoDB json format');


if (!process.argv || process.argv.length < 4) {
  console.log(`[ERROR] Missing command parameter(s)
    node convertJsonSkillsArray.js {SourceSkillGroupsJsonFilePath} {OutputSkillsJsonFilePath}
  `);
} else {
  const fs = require('fs');
  const sourcefilePath = process.argv[2];
  const outputfilePath = process.argv[3];

  console.log(`Reading from source json file: ${sourcefilePath}`);
  const sourceJson = require(sourcefilePath);

  console.log('Successfully read source json file');
  const mongoDBJsonArray = [];
  // console.log(sourceJson.employees.db1);
  if (outputfilePath) {
    fs.unlink(outputfilePath, () => {});
    console.log(`Saving to file ${outputfilePath}`);
  }

  // console.log(sourceJson);
  let skillGroupsArray = sourceJson;

  if (!skillGroupsArray || !skillGroupsArray.length) {
    console.log(`[ERROR] Collection "skills" not found or is empty!`);
  } else {
    let newSkillsArray = [];
    skillGroupsArray.forEach(skillGroup => {
      const { skills: skillsArray } = skillGroup;
      if (skillsArray && skillsArray.length) {
        newSkillsArray = newSkillsArray.concat(skillsArray.map(skill => {
          return ({
            skill: skill,
            hot: false,
          });
        }));
      }
    });

    // console.log(newSkillGroupsArray);
    if (outputfilePath) {
      newSkillsArray.forEach(newSkill => {
        const jsonString = JSON.stringify(newSkill);
          fs.appendFile(outputfilePath, jsonString + '\n\r', (err) => {
            // throws an error, you could also catch it here
            if (err) throw err;

            // success case, the file was saved
            // console.log(`Saved to file ${outputfilePath}`);
          });
      });
    } else {
      console.log(newSkillsArray);
    }
  }
}
