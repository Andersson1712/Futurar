import React, { useState } from 'react';
import StudentApp from './components/StudentApp';
import TeacherPanel from './components/TeacherPanel';
import { AuthProvider } from './contexts/AuthContext';

const App: React.FC = () => {
  const [mode, setMode] = useState<'student' | 'teacher'>('student');

  return (
    <AuthProvider>
      {mode === 'student' && (
        <StudentApp onSwitchToTeacher={() => setMode('teacher')} />
      )}
      {mode === 'teacher' && (
        <TeacherPanel onSwitchToStudent={() => setMode('student')} />
      )}
    </AuthProvider>
  );
};

export default App;
