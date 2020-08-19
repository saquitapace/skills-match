console.log(`Running convertJsonSkillGroups.js script to read in the old skill groups and the new skills collection json array files, and output a Mongo DB json file that contains the skill groups collections referencing the individual skill's id`);


if (!process.argv || process.argv.length < 4) {
  console.log(`[ERROR] Missing command parameter(s)
    node convertJsonSkillsArray.js {SourceSkillJsonFilePath} {SourceSkillGroupsJsonFilePath} {OutputNewSkillGroupsJsonFilePath}
  `);
} else {
  const fs = require('fs');
  const sourceSkillsFilePath = process.argv[2];
  const sourceSkillGroupsFilePath = process.argv[3];
  const outputNewSkillGroupsJsonFilePath = process.argv[4];

  console.log(`Reading from source skills json file: ${sourceSkillsFilePath}`);
  const sourceSkillsJson = require(sourceSkillsFilePath);

  console.log(`Reading from source skill groups json file: ${sourceSkillGroupsFilePath}`);
  const sourceSkillGroupsJson = require(sourceSkillGroupsFilePath);

  console.log('Successfully read source json file');
  const mongoDBJsonArray = [];
  // console.log(sourceJson.employees.db1);
  if (outputNewSkillGroupsJsonFilePath) {
    fs.unlink(outputNewSkillGroupsJsonFilePath, () => {});
    console.log(`Saving to file ${outputNewSkillGroupsJsonFilePath}`);
  }

  // console.log(sourceJson);
  let skillGroupsArray = sourceSkillGroupsJson;
  let skillsArray = sourceSkillsJson;

  const skillsMap = {};
  skillsArray.forEach(s => {
    skillsMap[s.skill] = s;
  });

  if (!skillGroupsArray || !skillGroupsArray.length) {
    console.log(`[ERROR] Collection "skillGoups" not found or is empty!`);
  } else if (!skillsArray || !skillsArray.length) {
    console.log(`[ERROR] Collection "skills" not found or is empty!`);
  } else {
    skillGroupsArray.forEach(skillGroup => {
      if (skillGroup.skills && skillGroup.skills.length) {
        const newSkillsArray = skillGroup.skills.map(skill => {
          const s = skillsMap[skill];
          // console.log("s: " + s);
          if (s && s._id) {
            // console.log("s._id: " + s._id);
            return s._id;
          }
        });
        skillGroup.skills = newSkillsArray;
      }
    });

    // console.log(newSkillGroupsArray);
    if (outputNewSkillGroupsJsonFilePath) {
      skillGroupsArray.forEach(skillGroup => {
        const jsonString = JSON.stringify(skillGroup);
          fs.appendFile(outputNewSkillGroupsJsonFilePath, jsonString + '\n\r', (err) => {
            // throws an error, you could also catch it here
            if (err) throw err;

            // success case, the file was saved
            // console.log(`Saved to file ${outputNewSkillGroupsJsonFilePath}`);
          });
      });
    } else {
      console.log(skillGroupsArray);
    }
  }
}
