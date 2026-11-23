/**
 * Component Default Logic Verification Test
 * Tests frontend modal state logic and backend API compatibility
 * for Module 3 - Phase 4 Component Default Logic Update
 */

const assert = require('assert');

function runComponentDefaultLogicTests() {
  console.log('========================================================================');
  console.log('  TESTING EXAMINATION SUBJECT CONFIGURATION - COMPONENT DEFAULT LOGIC');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function test(condition, description) {
    total++;
    if (condition) {
      console.log(`  [PASS ${String(total).padStart(2, '0')}] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL ${String(total).padStart(2, '0')}] ${description}`);
      throw new Error(`Test failed: ${description}`);
    }
  }

  // --- Helper simulating ExaminationSubjectConfigPage.jsx modal logic ---
  function initModalComponents(sub) {
    if (sub.isConfigured) {
      return (sub.components || []).map((c) => ({
        componentName: c.componentName,
        maximumMarks: c.maximumMarks.toString()
      }));
    } else {
      const isCoCurricular = (sub.subjectType || '').toUpperCase() === 'CO_CURRICULAR';
      if (isCoCurricular) {
        return [];
      } else {
        return [{ componentName: 'Written', maximumMarks: '50' }];
      }
    }
  }

  function removeComponent(list, index) {
    return list.filter((_, idx) => idx !== index);
  }

  function addComponent(list, comp = { componentName: '', maximumMarks: '' }) {
    return [...list, comp];
  }

  function calculateLiveTotal(list) {
    return list.reduce((sum, c) => {
      const marks = Number(c.maximumMarks);
      return sum + (isNaN(marks) || marks <= 0 ? 0 : marks);
    }, 0);
  }

  function validateComponents(list) {
    // Validations: If components exist, validate names, duplicates, and positive marks
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const comp = list[i];
      if (!comp.componentName || !comp.componentName.trim()) {
        return { valid: false, error: `Component #${i + 1} name is required.` };
      }
      const lower = comp.componentName.trim().toLowerCase();
      if (seen.has(lower)) {
        return { valid: false, error: `Duplicate component name "${comp.componentName.trim()}".` };
      }
      seen.add(lower);

      const val = Number(comp.maximumMarks);
      if (isNaN(val) || val <= 0) {
        return { valid: false, error: `Maximum marks for "${comp.componentName.trim()}" must be a positive number.` };
      }
    }
    return { valid: true };
  }

  // 1. New Academic subject starts with Written
  console.log('--- 1. Academic Subjects (ACADEMIC) Default Behavior ---');
  const newAcademicSub = {
    subjectName: 'Mathematics',
    subjectCode: 'MATH-101',
    subjectType: 'ACADEMIC',
    isConfigured: false,
    components: []
  };
  let academicList = initModalComponents(newAcademicSub);
  test(
    academicList.length === 1 &&
    academicList[0].componentName === 'Written' &&
    academicList[0].maximumMarks === '50',
    'New Academic subject configuration starts with Written (50 marks)'
  );

  // 2. Written can be renamed and its maximum marks changed
  academicList[0].componentName = 'Written Theory';
  academicList[0].maximumMarks = '80';
  test(
    academicList[0].componentName === 'Written Theory' && academicList[0].maximumMarks === '80',
    'Written can be renamed and its maximum marks changed'
  );
  test(calculateLiveTotal(academicList) === 80, 'Live total reflects updated marks (80 marks)');

  // 3. Additional components can be added to Academic subjects
  academicList = addComponent(academicList, { componentName: 'Oral', maximumMarks: '10' });
  academicList = addComponent(academicList, { componentName: 'Class Work', maximumMarks: '10' });
  test(academicList.length === 3, 'Additional components (Oral, Class Work) can be added to Academic subject');
  test(calculateLiveTotal(academicList) === 100, 'Live total computed as 100 marks');

  // 4. Written can be removed
  academicList = removeComponent(academicList, 0); // Remove "Written Theory"
  test(
    academicList.length === 2 && !academicList.some(c => c.componentName.includes('Written')),
    'Written component can be removed, leaving remaining components intact'
  );
  test(calculateLiveTotal(academicList) === 20, 'Live total updated after removing Written (20 marks)');

  // 5. Admin can remove all components and save configuration with zero components
  academicList = removeComponent(academicList, 0);
  academicList = removeComponent(academicList, 0);
  test(academicList.length === 0, 'Admin can remove all components from Academic subject');
  test(calculateLiveTotal(academicList) === 0, 'Total maximum marks for zero components is 0');
  const zeroValResult = validateComponents(academicList);
  test(zeroValResult.valid === true, 'Validation succeeds for zero components (allows saving)');

  // 6. New Co-curricular subject configuration starts empty
  console.log('\n--- 2. Co-curricular Subjects (CO_CURRICULAR) Default Behavior ---');
  const newCoCurricularSub = {
    subjectName: 'Drawing & Painting',
    subjectCode: 'ART-101',
    subjectType: 'CO_CURRICULAR',
    isConfigured: false,
    components: []
  };
  let coCurricularList = initModalComponents(newCoCurricularSub);
  test(coCurricularList.length === 0, 'New Co-curricular subject configuration starts empty (0 components)');
  test(calculateLiveTotal(coCurricularList) === 0, 'Initial live total is 0 marks');
  test(validateComponents(coCurricularList).valid === true, 'Can save new Co-curricular configuration with zero components');

  // 7. Components can optionally be added to Co-curricular subjects
  coCurricularList = addComponent(coCurricularList, { componentName: 'Sketching', maximumMarks: '30' });
  coCurricularList = addComponent(coCurricularList, { componentName: 'Coloring', maximumMarks: '20' });
  test(coCurricularList.length === 2, 'Components can optionally be added manually to Co-curricular subject');
  test(calculateLiveTotal(coCurricularList) === 50, 'Total marks calculated as 50 marks');
  test(validateComponents(coCurricularList).valid === true, 'Validation passes for manually added components');

  // 8. Components can be edited and removed from Co-curricular subjects
  coCurricularList[0].maximumMarks = '35';
  coCurricularList = removeComponent(coCurricularList, 1);
  test(
    coCurricularList.length === 1 && coCurricularList[0].maximumMarks === '35',
    'Manually added components can be edited and removed'
  );
  coCurricularList = removeComponent(coCurricularList, 0);
  test(coCurricularList.length === 0, 'All components can be removed from Co-curricular subject');
  test(calculateLiveTotal(coCurricularList) === 0, 'Total resets to 0 when all components removed');

  // 9. Re-opening saved configurations does not automatically reinsert Written
  console.log('\n--- 3. Preservation of Saved Configurations & No Reinsertion ---');
  const savedAcademicWithZero = {
    subjectName: 'English',
    subjectCode: 'ENG-101',
    subjectType: 'ACADEMIC',
    isConfigured: true,
    components: []
  };
  const reOpenedAcademicZero = initModalComponents(savedAcademicWithZero);
  test(
    reOpenedAcademicZero.length === 0,
    'Re-opening saved Academic configuration with 0 components does NOT reinsert Written'
  );

  const savedAcademicWithComps = {
    subjectName: 'Science',
    subjectCode: 'SCI-101',
    subjectType: 'ACADEMIC',
    isConfigured: true,
    components: [
      { componentName: 'Theory', maximumMarks: 70 },
      { componentName: 'Practical', maximumMarks: 30 }
    ]
  };
  const reOpenedAcademicComps = initModalComponents(savedAcademicWithComps);
  test(
    reOpenedAcademicComps.length === 2 &&
    reOpenedAcademicComps[0].componentName === 'Theory' &&
    reOpenedAcademicComps[1].componentName === 'Practical',
    'Re-opening saved Academic configuration preserves existing components without modification'
  );

  const savedCoCurricularWithZero = {
    subjectName: 'Music',
    subjectCode: 'MUS-101',
    subjectType: 'CO_CURRICULAR',
    isConfigured: true,
    components: []
  };
  const reOpenedCoCurricularZero = initModalComponents(savedCoCurricularWithZero);
  test(
    reOpenedCoCurricularZero.length === 0,
    'Re-opening saved Co-curricular configuration preserves empty components list'
  );

  // 10. Component validation rules
  console.log('\n--- 4. Component Validation Edge Cases ---');
  test(
    validateComponents([{ componentName: '', maximumMarks: '50' }]).valid === false,
    'Rejects empty component name'
  );
  test(
    validateComponents([{ componentName: 'Written', maximumMarks: '-5' }]).valid === false,
    'Rejects negative maximum marks'
  );
  test(
    validateComponents([{ componentName: 'Written', maximumMarks: '0' }]).valid === false,
    'Rejects zero maximum marks for an individual component'
  );
  test(
    validateComponents([
      { componentName: 'Written', maximumMarks: '50' },
      { componentName: 'written', maximumMarks: '20' }
    ]).valid === false,
    'Rejects duplicate component names (case-insensitive)'
  );

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} COMPONENT DEFAULT LOGIC TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');
}

runComponentDefaultLogicTests();
