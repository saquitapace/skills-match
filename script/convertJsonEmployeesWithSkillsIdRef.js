console.log('Running convertJsonEmployeesWithSkillsIdRef.js script to create new Employees DB collection that replaces skills string array with ObjectId reference array to Skills collection in MongoDB json format');


if (!process.argv || process.argv.length < 5) {
  console.log(`[ERROR] Missing command parameter(s)
    node convertJsonEmployeesWithSkillsIdRef.js {SourceEmployeesJsonFilePath} {SourceSkillsJsonFilePath} {OutputEmployeesJsonFilePath}
  `);
} else {
  const fs = require('fs');
  const sourceEmployeesFilePath = process.argv[2];
  const sourceSkillsFilePath = process.argv[3];
  const outputfilePath = process.argv[4];

  console.log(`Reading from source Employees json file: ${sourceEmployeesFilePath}`);
  const sourceEmployeesJson = require(sourceEmployeesFilePath);

  console.log(`Reading from source Skills json file: ${sourceSkillsFilePath}`);
  const sourceSkillsJson = require(sourceSkillsFilePath);

  console.log('Successfully read source json file');
  const mongoDBJsonArray = [];
  // console.log(sourceJson.employees.db1);
  if (outputfilePath) {
    fs.unlink(outputfilePath, () => {});
    console.log(`Saving to file ${outputfilePath}`);
  }

  if (!sourceEmployeesJson || !sourceEmployeesJson.length) {
    console.log(`[ERROR] Collection "employees" not found or is empty!`);
  } else {
    const outputEmployeesJson = sourceEmployeesJson.map(employee => {
      const outputEmployee = JSON.parse(JSON.stringify(employee));

      if (employee.skills && employee.skills.length) {
        const newSkills = employee.skills.map(employeeSkill => {
          const targetSkill = sourceSkillsJson.find(sourceSkill =>
            sourceSkill.skill.toLowerCase() === employeeSkill.skill.toLowerCase());

          if (!targetSkill) {
            const err = `Employee ${employee.id} with skill ${employeeSkill.skill} not found in skills collection`;
            console.log(err);
            throw(err);
          }

          const skill = {
            rating: employeeSkill.rating,
            skillId: targetSkill._id,
          };
          return skill;
        });

        outputEmployee.skills = newSkills;
      }

      return outputEmployee;
    });

    // console.log(newSkillGroupsArray);
    if (outputfilePath) {
      outputEmployeesJson.forEach(outputEmployee => {
        const jsonString = JSON.stringify(outputEmployee);
        fs.appendFile(outputfilePath, jsonString + '\n\r', (err) => {
          // throws an error, you could also catch it here
          if (err) throw err;

          // success case, the file was saved
          // console.log(`Saved to file ${outputfilePath}`);
        });
      });
    } else {
      console.log(outputEmployeesJson);
    }
  }
}
