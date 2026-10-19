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

function get_default_db() {
  return [
    'teacherPin' => '1234',
    'allowSelfRegister' => true,
    'students' => [],
    'projects' => []
  ];
}

function verify_teacher_pin($inputPin, $storedPin) {
  if (empty($inputPin) || empty($storedPin)) return false;
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
  if (!isset($decoded['teacherPin'])) $decoded['teacherPin'] = '1234';
  if (!isset($decoded['allowSelfRegister'])) $decoded['allowSelfRegister'] = true;
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

switch ($action) {
  case 'public_roster': {
    $roster = array_map(function($s) {
      return [
        'id' => $s['id'],
        'firstName' => $s['firstName'],
        'className' => isset($s['className']) ? $s['className'] : ''
      ];
    }, $db['students']);
    echo json_encode([
      'ok' => true,
      'allowSelfRegister' => (bool)$db['allowSelfRegister'],
      'students' => array_values($roster)
    ]);
    exit;
  }

  case 'student_login': {
    $firstName = trim(isset($body['firstName']) ? $body['firstName'] : '');
    $pin = trim(isset($body['pin']) ? $body['pin'] : '');
    $className = trim(isset($body['className']) ? $body['className'] : '');

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
      if (!empty($db['allowSelfRegister'])) {
        $newStudent = [
          'id' => 'stu_' . substr(md5(uniqid('', true)), 0, 10),
          'firstName' => $firstName,
          'pin' => $pin,
          'className' => $className,
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
        'className' => isset($matchedStudent['className']) ? $matchedStudent['className'] : ''
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

    $isTeacher = ($teacherPin !== '' && verify_teacher_pin($teacherPin, $db['teacherPin']));
    $student = null;
    foreach ($db['students'] as $s) {
      if ($s['id'] === $studentId && ($isTeacher || $pin === '' || $s['pin'] === $pin)) {
        $student = $s;
        break;
      }
    }

    if (!$student || (!$score && !$projectData) || $title === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Invalid student session or missing song title.']);
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
        'studentName' => $student['firstName'],
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

  default:
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unknown action']);
    exit;
}
