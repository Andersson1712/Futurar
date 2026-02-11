import React, { useState } from 'react';
import StudentApp from './components/StudentApp';
import TeacherPanel from './components/TeacherPanel';

const App: React.FC = () => {
  const [mode, setMode] = useState<'student' | 'teacher'>('student');

  return (
    <>
      {mode === 'student' && (
        <StudentApp onSwitchToTeacher={() => setMode('teacher')} />
      )}
      {mode === 'teacher' && (
        <TeacherPanel onSwitchToStudent={() => setMode('student')} />
      )}
    </>
  );
};

export default App;
