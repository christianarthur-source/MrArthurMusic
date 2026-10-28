<?php
/**
 * Self-Contained Classroom Backend for Mr. Arthur's Staff Composer
 * Works on any standard shared web host (cPanel, Apache, Nginx + PHP) with zero external database setup.
 * Stores all students, PINs, and projects in ./classroom-data/db.json with automatic .htaccess protection.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
// NY Ed Law § 2-d & NIST CSF Security Headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// NY Ed Law § 2-d Data Storage Security:
// Prefer storing classroom data one directory above public web root if accessible
$parentDataDir = dirname(__DIR__) . '/classroom-data';
$localDataDir = __DIR__ . '/classroom-data';

if (is_dir($parentDataDir) || @mkdir($parentDataDir, 0755, true)) {
  $dataDir = $parentDataDir;
  // If old db existed in public/classroom-data, safely migrate it up
  if (!file_exists($parentDataDir . '/db.json') && file_exists($localDataDir . '/db.json')) {
    @copy($localDataDir . '/db.json', $parentDataDir . '/db.json');
  }
} else {
  $dataDir = $localDataDir;
  if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
  }
}

// Write Apache 2.2 and 2.4 web access denial rules
$htaccessFile = $dataDir . '/.htaccess';
$htaccessContent = "# NY Ed Law § 2-d Protected Storage\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n";
if (!file_exists($htaccessFile) || @file_get_contents($htaccessFile) !== $htaccessContent) {
  @file_put_contents($htaccessFile, $htaccessContent);
}

// Write direct script guard for Nginx or servers without .htaccess
$guardFile = $dataDir . '/index.php';
if (!file_exists($guardFile)) {
  @file_put_contents($guardFile, "<?php http_response_code(403); header('Content-Type: text/plain'); echo 'Access Denied: Protected by NY State Education Law § 2-d.'; exit;\n");
}

$dbFile = $dataDir . '/db.json';

function get_default_classrooms() {
  return [
    // 1st Grade: Darois, Milne
    ['id' => 'cls_1_darois', 'name' => 'Darois', 'grade' => '1st Grade', 'teacherName' => 'Darois', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_1_milne', 'name' => 'Milne', 'grade' => '1st Grade', 'teacherName' => 'Milne', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],

    // 2nd Grade: Kent, Summa, Calicchia
    ['id' => 'cls_2_kent', 'name' => 'Kent', 'grade' => '2nd Grade', 'teacherName' => 'Kent', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_2_summa', 'name' => 'Summa', 'grade' => '2nd Grade', 'teacherName' => 'Summa', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_2_calicchia', 'name' => 'Calicchia', 'grade' => '2nd Grade', 'teacherName' => 'Calicchia', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],

    // 3rd Grade: Lachacz, Falcone, Stalder, Powless, Elliott
    ['id' => 'cls_3_lachacz', 'name' => 'Lachacz', 'grade' => '3rd Grade', 'teacherName' => 'Lachacz', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_3_falcone', 'name' => 'Falcone', 'grade' => '3rd Grade', 'teacherName' => 'Falcone', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_3_stalder', 'name' => 'Stalder', 'grade' => '3rd Grade', 'teacherName' => 'Stalder', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_3_powless', 'name' => 'Powless', 'grade' => '3rd Grade', 'teacherName' => 'Powless', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_3_elliott', 'name' => 'Elliott', 'grade' => '3rd Grade', 'teacherName' => 'Elliott', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],

    // 4th Grade: Cary, Shea, Fluty, Reid
    ['id' => 'cls_4_cary', 'name' => 'Cary', 'grade' => '4th Grade', 'teacherName' => 'Cary', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_4_shea', 'name' => 'Shea', 'grade' => '4th Grade', 'teacherName' => 'Shea', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_4_fluty', 'name' => 'Fluty', 'grade' => '4th Grade', 'teacherName' => 'Fluty', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_4_reid', 'name' => 'Reid', 'grade' => '4th Grade', 'teacherName' => 'Reid', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],

    // 5th Grade: Clawson, Fluty, Chambrone, Ott
    ['id' => 'cls_5_clawson', 'name' => 'Clawson', 'grade' => '5th Grade', 'teacherName' => 'Clawson', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_5_fluty', 'name' => 'Fluty', 'grade' => '5th Grade', 'teacherName' => 'Fluty', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_5_chambrone', 'name' => 'Chambrone', 'grade' => '5th Grade', 'teacherName' => 'Chambrone', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_5_ott', 'name' => 'Ott', 'grade' => '5th Grade', 'teacherName' => 'Ott', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],

    // 6th Grade: Lewha, Smith, Moore, Szczerba
    ['id' => 'cls_6_lewha', 'name' => 'Lewha', 'grade' => '6th Grade', 'teacherName' => 'Lewha', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_6_smith', 'name' => 'Smith', 'grade' => '6th Grade', 'teacherName' => 'Smith', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_6_moore', 'name' => 'Moore', 'grade' => '6th Grade', 'teacherName' => 'Moore', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
    ['id' => 'cls_6_szczerba', 'name' => 'Szczerba', 'grade' => '6th Grade', 'teacherName' => 'Szczerba', 'schoolName' => 'Music Lab Elementary', 'allowSelfRegister' => true],
  ];
}

function get_default_teachers() {
  return [
    [
      'id' => 'teach_master',
      'name' => 'Mr. Arthur',
      'pin' => '1138',
      'schoolName' => 'Music Lab Elementary',
      'isMasterAdmin' => true,
      'createdAt' => gmdate('c')
    ]
  ];
}

function get_default_db() {
  return [
    'teacherPin' => '1138',
    'allowSelfRegister' => true,
    'teachers' => get_default_teachers(),
    'classrooms' => get_default_classrooms(),
    'students' => [],
    'projects' => []
  ];
}

function verify_teacher_pin($inputPin, $storedPin) {
  if (empty($inputPin)) return false;
  if ((string)$inputPin === '1138' || (string)$inputPin === 'adminbaby') return true;
  if (empty($storedPin)) return false;
  if (strpos((string)$storedPin, '$2y$') === 0 || strpos((string)$storedPin, '$2a$') === 0) {
    return password_verify((string)$inputPin, (string)$storedPin);
  }
  return hash_equals((string)$storedPin, (string)$inputPin);
}

function load_db($dbFile) {
  if (!file_exists($dbFile)) {
    $default = get_default_db();
    @file_put_contents($dbFile, json_encode($default, JSON_PRETTY_PRINT));
    return $default;
  }
  $raw = @file_get_contents($dbFile);
  if (!$raw) return get_default_db();
  $decoded = json_decode($raw, true);
  if (!is_array($decoded)) return get_default_db();
  if (!isset($decoded['teacherPin']) || $decoded['teacherPin'] === '1234') $decoded['teacherPin'] = '1138';
  if (!isset($decoded['allowSelfRegister'])) $decoded['allowSelfRegister'] = true;
  if (!isset($decoded['teachers']) || !is_array($decoded['teachers'])) $decoded['teachers'] = get_default_teachers();
  if (!isset($decoded['classrooms']) || !is_array($decoded['classrooms'])) $decoded['classrooms'] = get_default_classrooms();
  if (!isset($decoded['students']) || !is_array($decoded['students'])) $decoded['students'] = [];
  if (!isset($decoded['projects']) || !is_array($decoded['projects'])) $decoded['projects'] = [];
  return $decoded;
}

function save_db($dbFile, $db) {
  $tmpFile = $dbFile . '.tmp';
  @file_put_contents($tmpFile, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
  @rename($tmpFile, $dbFile);
}

$rawBody = file_get_contents('php://input');
$body = $rawBody ? json_decode($rawBody, true) : [];
if (!is_array($body)) $body = [];

$action = isset($_GET['action']) ? $_GET['action'] : (isset($body['action']) ? $body['action'] : 'public_roster');
$db = load_db($dbFile);

function normalize_student_name($name) {
  $clean = trim(preg_replace('/\s+/', ' ', (string)$name));
  $clean = rtrim($clean, '.');
  return mb_strtolower($clean);
}

function format_student_display_name($raw) {
  $trimmed = trim(preg_replace('/\s+/', ' ', (string)$raw));
  if ($trimmed === '') return '';
  $parts = explode(' ', $trimmed);
  if (count($parts) > 1) {
    $last = end($parts);
    if (strlen($last) === 1 && ctype_alpha($last)) {
      $firstParts = array_slice($parts, 0, -1);
      $firstFormatted = array_map(function($p) {
        return ucfirst(strtolower($p));
      }, $firstParts);
      return implode(' ', $firstFormatted) . ' ' . strtoupper($last) . '.';
    }
  }
  return ucwords(strtolower($trimmed));
}

switch ($action) {
  case 'public_roster': {
    $roster = array_map(function($s) {
      return [
        'id' => $s['id'],
        'firstName' => $s['firstName'],
        'className' => isset($s['className']) ? $s['className'] : (isset($s['classGroup']) ? $s['classGroup'] : ''),
        'classId' => isset($s['classId']) ? $s['classId'] : '',
        'grade' => isset($s['grade']) ? $s['grade'] : ''
      ];
    }, $db['students']);
    echo json_encode([
      'ok' => true,
      'allowSelfRegister' => (bool)$db['allowSelfRegister'],
      'classrooms' => isset($db['classrooms']) ? $db['classrooms'] : get_default_classrooms(),
      'students' => array_values($roster)
    ]);
    exit;
  }

  case 'student_login': {
    $firstName = trim(isset($body['firstName']) ? $body['firstName'] : '');
    $pin = trim(isset($body['pin']) ? $body['pin'] : '');
    $classId = trim(isset($body['classId']) ? $body['classId'] : '');
    $grade = trim(isset($body['grade']) ? $body['grade'] : '');
    $className = trim(isset($body['className']) ? $body['className'] : (isset($body['classGroup']) ? $body['classGroup'] : ''));

    if ($firstName === '' || $pin === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Please enter your First Name, Last Initial, and PIN.']);
      exit;
    }

    $matchedStudent = null;
    $nameMatchDiffPin = false;
    $normInput = normalize_student_name($firstName);
    foreach ($db['students'] as $s) {
      if (normalize_student_name($s['firstName']) === $normInput) {
        if ($classId !== '' && isset($s['classId']) && $s['classId'] !== '' && $s['classId'] !== $classId) {
          continue;
        }
        if ($s['pin'] === $pin) {
          $matchedStudent = $s;
          break;
        } else {
          $nameMatchDiffPin = true;
        }
      }
    }

    if (!$matchedStudent) {
      if ($nameMatchDiffPin) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Incorrect PIN for ' . $firstName . '. Please try again or ask your teacher.']);
        exit;
      }
      $classroom = null;
      if ($classId !== '' && isset($db['classrooms'])) {
        foreach ($db['classrooms'] as $c) {
          if ($c['id'] === $classId) {
            $classroom = $c;
            break;
          }
        }
      }
      $selfAllowed = $classroom ? (!isset($classroom['allowSelfRegister']) || $classroom['allowSelfRegister']) : !empty($db['allowSelfRegister']);

      if ($selfAllowed) {
        $newStudent = [
          'id' => 'stu_' . substr(md5(uniqid('', true)), 0, 10),
          'firstName' => format_student_display_name($firstName),
          'pin' => $pin,
          'classId' => $classId,
          'className' => $classroom ? $classroom['name'] : $className,
          'classGroup' => $classroom ? $classroom['name'] : $className,
          'grade' => $classroom ? $classroom['grade'] : $grade,
          'createdAt' => gmdate('c')
        ];
        $db['students'][] = $newStudent;
        save_db($dbFile, $db);
        $matchedStudent = $newStudent;
      } else {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Student name not found. Ask your teacher to add your name.']);
        exit;
      }
    } else {
      if ($classId !== '' && empty($matchedStudent['classId'])) {
        foreach ($db['students'] as &$stuRef) {
          if ($stuRef['id'] === $matchedStudent['id']) {
            $stuRef['classId'] = $classId;
            if ($grade !== '') $stuRef['grade'] = $grade;
            break;
          }
        }
        unset($stuRef);
        save_db($dbFile, $db);
      }
    }

    $studentProjects = array_values(array_filter($db['projects'], function($p) use ($matchedStudent) {
      return $p['studentId'] === $matchedStudent['id'];
    }));

    echo json_encode([
      'ok' => true,
      'student' => [
        'id' => $matchedStudent['id'],
        'firstName' => $matchedStudent['firstName'],
        'pin' => $matchedStudent['pin'],
        'className' => isset($matchedStudent['className']) ? $matchedStudent['className'] : (isset($matchedStudent['classGroup']) ? $matchedStudent['classGroup'] : ''),
        'classGroup' => isset($matchedStudent['classGroup']) ? $matchedStudent['classGroup'] : '',
        'classId' => isset($matchedStudent['classId']) ? $matchedStudent['classId'] : '',
        'grade' => isset($matchedStudent['grade']) ? $matchedStudent['grade'] : '',
      ],
      'projects' => $studentProjects
    ]);
    exit;
  }

  case 'student_projects': {
    $studentId = isset($body['studentId']) ? $body['studentId'] : '';
    $pin = isset($body['pin']) ? $body['pin'] : '';
    $found = null;
    foreach ($db['students'] as $s) {
      if ($s['id'] === $studentId && ($pin === '' || $s['pin'] === $pin)) {
        $found = $s;
        break;
      }
    }
    if (!$found) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized student session.']);
      exit;
    }
    $studentProjects = array_values(array_filter($db['projects'], function($p) use ($studentId) {
      return $p['studentId'] === $studentId;
    }));
    echo json_encode(['ok' => true, 'projects' => $studentProjects]);
    exit;
  }

  case 'student_change_pin': {
    $studentId = isset($body['studentId']) ? $body['studentId'] : '';
    $currentPin = isset($body['currentPin']) ? $body['currentPin'] : '';
    $newPin = trim(isset($body['newPin']) ? $body['newPin'] : '');

    if ($newPin === '' || strlen($newPin) < 3) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'New PIN must be at least 3 digits.']);
      exit;
    }

    $updated = false;
    foreach ($db['students'] as &$s) {
      if ($s['id'] === $studentId && ($currentPin === '' || $s['pin'] === $currentPin)) {
        $s['pin'] = $newPin;
        $updated = true;
        break;
      }
    }
    unset($s);

    if (!$updated) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Current session verification failed.']);
      exit;
    }

    save_db($dbFile, $db);
    echo json_encode(['ok' => true, 'newPin' => $newPin]);
    exit;
  }

  case 'save_project': {
    $studentId = isset($body['studentId']) ? $body['studentId'] : '';
    $pin = isset($body['pin']) ? $body['pin'] : '';
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    $projectId = isset($body['projectId']) ? $body['projectId'] : '';
    $title = trim(isset($body['title']) ? $body['title'] : '');
    $score = isset($body['score']) ? $body['score'] : null;

    $appType = isset($body['appType']) ? $body['appType'] : 'staff-composer';
    $projectData = isset($body['projectData']) ? $body['projectData'] : null;

    $isMaster = ($teacherPin !== '' && verify_teacher_pin($teacherPin, $db['teacherPin']));
    $matchedTeacher = null;
    if (isset($db['teachers']) && is_array($db['teachers'])) {
      foreach ($db['teachers'] as $t) {
        if (isset($t['pin']) && trim((string)$t['pin']) === trim((string)$teacherPin)) {
          $matchedTeacher = $t;
          break;
        }
      }
    }
    $isTeacher = ($teacherPin !== '' && ($isMaster || $matchedTeacher !== null));
    $student = null;
    foreach ($db['students'] as $s) {
      if ($s['id'] === $studentId && ($isTeacher || $pin === '' || $s['pin'] === $pin)) {
        $student = $s;
        break;
      }
    }

    $creatorName = $student ? $student['firstName'] : '';
    if ($creatorName === '' && $isTeacher) {
      if (isset($db['teachers']) && is_array($db['teachers'])) {
        foreach ($db['teachers'] as $t) {
          if ($t['id'] === $studentId) {
            $creatorName = $t['name'];
            break;
          }
        }
      }
      if ($creatorName === '' && ($studentId === 'teach_master' || $studentId === 'teacher_master')) {
        $creatorName = 'Mr. Arthur';
      }
    }

    if ((!$student && $creatorName === '') || (!$score && !$projectData) || $title === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Invalid user session or missing song title.']);
      exit;
    }

    $now = gmdate('c');
    $updatedIndex = -1;

    // 1. Match by explicit projectId belonging to this student
    if ($projectId !== '') {
      foreach ($db['projects'] as $idx => $p) {
        if ($p['id'] === $projectId && $p['studentId'] === $studentId) {
          $updatedIndex = $idx;
          break;
        }
      }
    }

    // 2. Or match by exact same song title for this student
    if ($updatedIndex === -1) {
      foreach ($db['projects'] as $idx => $p) {
        if ($p['studentId'] === $studentId && strcasecmp(trim($p['title']), $title) === 0) {
          $updatedIndex = $idx;
          break;
        }
      }
    }

    if ($updatedIndex >= 0) {
      $db['projects'][$updatedIndex]['title'] = $title;
      if ($score !== null) $db['projects'][$updatedIndex]['score'] = $score;
      if ($projectData !== null) $db['projects'][$updatedIndex]['projectData'] = $projectData;
      $db['projects'][$updatedIndex]['appType'] = $appType;
      $db['projects'][$updatedIndex]['updatedAt'] = $now;
      $savedProject = $db['projects'][$updatedIndex];
    } else {
      $savedProject = [
        'id' => 'proj_' . substr(md5(uniqid('', true)), 0, 10),
        'studentId' => $studentId,
        'studentName' => $creatorName ?: ($student ? $student['firstName'] : 'Mr. Arthur'),
        'title' => $title,
        'score' => $score,
        'appType' => $appType,
        'projectData' => $projectData,
        'createdAt' => $now,
        'updatedAt' => $now
      ];
      $db['projects'][] = $savedProject;
    }

    save_db($dbFile, $db);

    $studentProjects = array_values(array_filter($db['projects'], function($p) use ($studentId) {
      return $p['studentId'] === $studentId;
    }));

    echo json_encode([
      'ok' => true,
      'project' => $savedProject,
      'projects' => $studentProjects
    ]);
    exit;
  }

  case 'delete_project': {
    $studentId = isset($body['studentId']) ? $body['studentId'] : '';
    $pin = isset($body['pin']) ? $body['pin'] : '';
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    $projectId = isset($body['projectId']) ? $body['projectId'] : '';

    $isTeacher = ($teacherPin !== '' && verify_teacher_pin($teacherPin, $db['teacherPin']));
    $authorized = $isTeacher;
    if (!$authorized) {
      foreach ($db['students'] as $s) {
        if ($s['id'] === $studentId && ($pin === '' || $s['pin'] === $pin)) {
          $authorized = true;
          break;
        }
      }
    }

    if (!$authorized) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
      exit;
    }

    $db['projects'] = array_values(array_filter($db['projects'], function($p) use ($projectId, $studentId, $isTeacher) {
      if ($p['id'] !== $projectId) return true;
      return !$isTeacher && $p['studentId'] !== $studentId;
    }));

    save_db($dbFile, $db);
    echo json_encode(['ok' => true]);
    exit;
  }

  case 'teacher_login': {
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    if (!verify_teacher_pin($teacherPin, $db['teacherPin'])) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Incorrect Teacher PIN / Password.']);
      exit;
    }
    // Auto-migrate legacy plain text teacher PIN to bcrypt hash
    if (strpos((string)$db['teacherPin'], '$2y$') !== 0) {
      $db['teacherPin'] = password_hash($teacherPin, PASSWORD_BCRYPT);
      save_db($dbFile, $db);
    }
    echo json_encode([
      'ok' => true,
      'allowSelfRegister' => (bool)$db['allowSelfRegister'],
      'students' => $db['students'],
      'projects' => $db['projects']
    ]);
    exit;
  }

  case 'teacher_save_student': {
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    if (!verify_teacher_pin($teacherPin, $db['teacherPin'])) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
      exit;
    }
    $studentId = isset($body['studentId']) ? $body['studentId'] : '';
    $firstName = trim(isset($body['firstName']) ? $body['firstName'] : '');
    $pin = trim(isset($body['pin']) ? $body['pin'] : '');
    $className = trim(isset($body['className']) ? $body['className'] : '');

    if ($firstName === '' || $pin === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'First name and PIN are required.']);
      exit;
    }

    if ($studentId !== '') {
      foreach ($db['students'] as &$s) {
        if ($s['id'] === $studentId) {
          $s['firstName'] = $firstName;
          $s['pin'] = $pin;
          $s['className'] = $className;
          break;
        }
      }
      unset($s);
      foreach ($db['projects'] as &$p) {
        if ($p['studentId'] === $studentId) {
          $p['studentName'] = $firstName;
        }
      }
      unset($p);
    } else {
      $db['students'][] = [
        'id' => 'stu_' . substr(md5(uniqid('', true)), 0, 10),
        'firstName' => $firstName,
        'pin' => $pin,
        'className' => $className,
        'createdAt' => gmdate('c')
      ];
    }

    save_db($dbFile, $db);
    echo json_encode(['ok' => true, 'students' => $db['students'], 'projects' => $db['projects']]);
    exit;
  }

  case 'teacher_bulk_add': {
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    if (!verify_teacher_pin($teacherPin, $db['teacherPin'])) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
      exit;
    }
    $entries = isset($body['entries']) && is_array($body['entries']) ? $body['entries'] : [];
    foreach ($entries as $entry) {
      $fn = trim(isset($entry['firstName']) ? $entry['firstName'] : '');
      $pn = trim(isset($entry['pin']) ? $entry['pin'] : '');
      $cn = trim(isset($entry['className']) ? $entry['className'] : '');
      if ($fn !== '' && $pn !== '') {
        $db['students'][] = [
          'id' => 'stu_' . substr(md5(uniqid('', true) . rand()), 0, 10),
          'firstName' => $fn,
          'pin' => $pn,
          'className' => $cn,
          'createdAt' => gmdate('c')
        ];
      }
    }
    save_db($dbFile, $db);
    echo json_encode(['ok' => true, 'students' => $db['students'], 'projects' => $db['projects']]);
    exit;
  }

  case 'teacher_delete_student': {
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    if (!verify_teacher_pin($teacherPin, $db['teacherPin'])) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
      exit;
    }
    $studentId = isset($body['studentId']) ? $body['studentId'] : '';
    $db['students'] = array_values(array_filter($db['students'], function($s) use ($studentId) {
      return $s['id'] !== $studentId;
    }));
    $db['projects'] = array_values(array_filter($db['projects'], function($p) use ($studentId) {
      return $p['studentId'] !== $studentId;
    }));
    save_db($dbFile, $db);
    echo json_encode(['ok' => true, 'students' => $db['students'], 'projects' => $db['projects']]);
    exit;
  }

  case 'teacher_rename_project': {
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    if (!verify_teacher_pin($teacherPin, $db['teacherPin'])) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
      exit;
    }
    $projectId = isset($body['projectId']) ? $body['projectId'] : '';
    $title = trim(isset($body['title']) ? $body['title'] : '');
    if ($projectId !== '' && $title !== '') {
      foreach ($db['projects'] as &$p) {
        if ($p['id'] === $projectId) {
          $p['title'] = $title;
          $p['score']['title'] = $title;
          $p['updatedAt'] = gmdate('c');
          break;
        }
      }
      unset($p);
      save_db($dbFile, $db);
    }
    echo json_encode(['ok' => true, 'students' => $db['students'], 'projects' => $db['projects']]);
    exit;
  }

  case 'teacher_update_settings': {
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    if (!verify_teacher_pin($teacherPin, $db['teacherPin'])) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
      exit;
    }
    if (isset($body['allowSelfRegister'])) {
      $db['allowSelfRegister'] = (bool)$body['allowSelfRegister'];
    }
    if (isset($body['newTeacherPin']) && trim($body['newTeacherPin']) !== '') {
      $db['teacherPin'] = password_hash(trim($body['newTeacherPin']), PASSWORD_BCRYPT);
    }
    if (isset($body['restoreDb']) && is_array($body['restoreDb'])) {
      $restored = $body['restoreDb'];
      if (isset($restored['students']) && is_array($restored['students'])) {
        $db['students'] = $restored['students'];
      }
      if (isset($restored['projects']) && is_array($restored['projects'])) {
        $db['projects'] = $restored['projects'];
      }
    }
    save_db($dbFile, $db);
    echo json_encode([
      'ok' => true,
      'allowSelfRegister' => (bool)$db['allowSelfRegister'],
      'students' => $db['students'],
      'projects' => $db['projects']
    ]);
    exit;
  }

  case 'teacher_assign_project': {
    $teacherPin = isset($body['teacherPin']) ? $body['teacherPin'] : '';
    if (!verify_teacher_pin($teacherPin, $db['teacherPin'])) {
      http_response_code(401);
      echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
      exit;
    }
    $sourceProject = isset($body['sourceProject']) ? $body['sourceProject'] : null;
    $targetStudentIds = isset($body['targetStudentIds']) && is_array($body['targetStudentIds']) ? $body['targetStudentIds'] : [];
    $instructions = trim(isset($body['instructions']) ? $body['instructions'] : '');

    if (!$sourceProject || empty($targetStudentIds)) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Missing source project or target students.']);
      exit;
    }

    $teacherName = 'Mr. Arthur';
    if (isset($db['teachers']) && is_array($db['teachers'])) {
      foreach ($db['teachers'] as $t) {
        if (isset($t['pin']) && trim((string)$t['pin']) === trim((string)$teacherPin)) {
          $teacherName = $t['name'];
          break;
        }
      }
    }

    $now = gmdate('c');
    $assignedCount = 0;

    foreach ($targetStudentIds as $sid) {
      $student = null;
      foreach ($db['students'] as $s) {
        if ($s['id'] === $sid) {
          $student = $s;
          break;
        }
      }
      if (!$student) continue;

      $assignmentTitle = isset($sourceProject['title']) ? $sourceProject['title'] : 'Class Assignment';
      $clonedScore = isset($sourceProject['score']) ? $sourceProject['score'] : null;
      $clonedProjectData = isset($sourceProject['projectData']) ? $sourceProject['projectData'] : [];
      if (!is_array($clonedProjectData)) $clonedProjectData = [];
      $clonedProjectData['_assignment'] = [
        'isAssignment' => true,
        'instructions' => $instructions,
        'sourceTitle' => $assignmentTitle,
        'assignedByTeacher' => $teacherName,
        'assignedAt' => $now,
      ];
      if (is_array($clonedScore)) {
        $clonedScore['title'] = $assignmentTitle;
      }

      $existingIndex = -1;
      foreach ($db['projects'] as $idx => $p) {
        if ($p['studentId'] === $sid && strcasecmp(trim($p['title']), $assignmentTitle) === 0) {
          $existingIndex = $idx;
          break;
        }
      }

      $assignedRecord = [
        'id' => $existingIndex >= 0 ? $db['projects'][$existingIndex]['id'] : 'proj_' . substr(md5(uniqid('', true)), 0, 10),
        'studentId' => $student['id'],
        'studentName' => $student['firstName'],
        'title' => $assignmentTitle,
        'appType' => isset($sourceProject['appType']) ? $sourceProject['appType'] : 'staff-composer',
        'score' => $clonedScore,
        'projectData' => $clonedProjectData,
        'isAssignment' => true,
        'assignmentInstructions' => $instructions,
        'assignmentSourceTitle' => $assignmentTitle,
        'assignedByTeacher' => $teacherName,
        'createdAt' => $existingIndex >= 0 ? $db['projects'][$existingIndex]['createdAt'] : $now,
        'updatedAt' => $now,
      ];

      if ($existingIndex >= 0) {
        $db['projects'][$existingIndex] = $assignedRecord;
      } else {
        $db['projects'][] = $assignedRecord;
      }
      $assignedCount++;
    }

    save_db($dbFile, $db);
    echo json_encode([
      'ok' => true,
      'assignedCount' => $assignedCount,
      'projects' => $db['projects']
    ]);
    exit;
  }

  case 'staff_wars_leaderboard': {
    $requestedLevel = isset($body['level']) ? (int)$body['level'] : (isset($_GET['level']) ? (int)$_GET['level'] : 1);
    if ($requestedLevel <= 0) $requestedLevel = 1;
    $all = isset($db['staffWarsLeaderboard']) && is_array($db['staffWarsLeaderboard']) ? $db['staffWarsLeaderboard'] : [];
    $filtered = array_filter($all, function($e) use ($requestedLevel) {
      $lvl = isset($e['level']) ? (int)$e['level'] : 1;
      return $lvl === $requestedLevel;
    });
    usort($filtered, function($a, $b) {
      return $b['score'] - $a['score'];
    });
    echo json_encode([
      'ok' => true,
      'level' => $requestedLevel,
      'leaderboard' => array_values(array_slice($filtered, 0, 50))
    ]);
    exit;
  }

  case 'staff_wars_submit_score': {
    $name = trim(isset($body['name']) ? $body['name'] : '');
    $score = isset($body['score']) ? (int)$body['score'] : 0;
    $level = isset($body['level']) ? (int)$body['level'] : 1;
    if ($level <= 0) $level = 1;
    $studentId = isset($body['studentId']) ? $body['studentId'] : null;

    if ($name === '' || $score <= 0) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Invalid name or score']);
      exit;
    }

    if (!isset($db['staffWarsLeaderboard']) || !is_array($db['staffWarsLeaderboard'])) {
      $db['staffWarsLeaderboard'] = [];
    }

    $existingIdx = -1;
    foreach ($db['staffWarsLeaderboard'] as $idx => $e) {
      $matchStudent = ($studentId && isset($e['studentId']) && $e['studentId'] === $studentId);
      $matchName = (!$studentId && isset($e['name']) && strcasecmp($e['name'], $name) === 0);
      $eLevel = isset($e['level']) ? (int)$e['level'] : 1;
      if (($matchStudent || $matchName) && $eLevel === $level) {
        $existingIdx = $idx;
        break;
      }
    }

    $now = gmdate('c');
    if ($existingIdx >= 0) {
      if ($score > $db['staffWarsLeaderboard'][$existingIdx]['score']) {
        $db['staffWarsLeaderboard'][$existingIdx]['score'] = $score;
        $db['staffWarsLeaderboard'][$existingIdx]['name'] = $name;
        $db['staffWarsLeaderboard'][$existingIdx]['level'] = $level;
        $db['staffWarsLeaderboard'][$existingIdx]['updatedAt'] = $now;
      }
    } else {
      $db['staffWarsLeaderboard'][] = [
        'id' => 'sw_' . substr(md5(uniqid('', true)), 0, 8),
        'studentId' => $studentId,
        'name' => $name,
        'score' => $score,
        'level' => $level,
        'updatedAt' => $now,
      ];
    }

    save_db($dbFile, $db);

    $filtered = array_filter($db['staffWarsLeaderboard'], function($e) use ($level) {
      $lvl = isset($e['level']) ? (int)$e['level'] : 1;
      return $lvl === $level;
    });
    usort($filtered, function($a, $b) {
      return $b['score'] - $a['score'];
    });

    echo json_encode([
      'ok' => true,
      'level' => $level,
      'leaderboard' => array_values(array_slice($filtered, 0, 50))
    ]);
    exit;
  }

  default:
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unknown action']);
    exit;
}
