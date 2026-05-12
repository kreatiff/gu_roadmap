# Expand Category Icon Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ~118-icon hardcoded list in IconPicker with a ~533-icon curated list organized into 4 theme groups.

**Architecture:** Single-file content change to `client/src/components/IconPicker.jsx`. The component already imports all of lucide-react via `import * as Icons from 'lucide-react'`. We replace the `ICON_LIST` array (lines 5-22) and update the search placeholder text. The `VALID_ICONS` filter remains as a runtime safety net.

**Tech Stack:** React, lucide-react

---

### Task 1: Replace ICON_LIST and Update Placeholder

**Files:**
- Modify: `client/src/components/IconPicker.jsx`

- [ ] **Step 1: Replace the ICON_LIST array (lines 5-22) and update the placeholder (line 63)**

Replace:

```js
const ICON_LIST = [
  // Web Dev
  'Laptop', 'Code', 'Database', 'Cpu', 'Globe', 'Server', 'Smartphone', 'Tablet', 'Monitor', 'Cloud',
  ...
];
```

With:

```js
const ICON_LIST = [
  // Education & University
  'Atom', 'Award', 'Backpack', 'Beaker', 'Bell', 'Book', 'BookA', 'BookCheck',
  'BookCopy', 'BookKey', 'BookLock', 'BookMarked', 'BookMinus', 'BookOpen', 'BookOpenCheck', 'BookOpenText',
  'BookPlus', 'BookText', 'BookType', 'BookUp', 'BookUser', 'BookX', 'Bookmark', 'BookmarkCheck',
  'BookmarkMinus', 'BookmarkPlus', 'Brain', 'BrainCircuit', 'Calculator', 'Calendar', 'CalendarCheck', 'CalendarDays',
  'CalendarPlus', 'CalendarRange', 'Compass', 'Dna', 'Earth', 'Eraser', 'FileSpreadsheet', 'FlaskConical',
  'Globe', 'GlobeLock', 'GraduationCap', 'Keyboard', 'Languages', 'Library', 'LibraryBig', 'Lightbulb',
  'LightbulbOff', 'Map', 'MapPin', 'Medal', 'Microscope', 'Music', 'Music4', 'Notebook',
  'NotebookPen', 'NotebookTabs', 'NotebookText', 'Palette', 'Pen', 'PenTool', 'Pencil', 'PencilLine',
  'PencilRuler', 'Presentation', 'Printer', 'Ruler', 'School', 'Search', 'Sigma', 'Strikethrough',
  'Tablet', 'Trophy', 'University', 'Users', 'Video', 'Wifi', 'Wrench', 'Monitor',
  'Laptop', 'Smartphone', 'TabletSmartphone', 'BarChart', 'BarChart2', 'BarChart3', 'BarChart4', 'BarChartBig',
  'BarChartHorizontal', 'BarChartHorizontalBig', 'ChartArea', 'ChartBar', 'ChartBarBig', 'ChartBarDecreasing', 'ChartBarIncreasing', 'ChartBarStacked',
  'ChartColumn', 'ChartColumnBig', 'ChartColumnDecreasing', 'ChartColumnIncreasing', 'ChartColumnStacked', 'ChartGantt', 'ChartLine', 'ChartNetwork',
  'ChartNoAxesColumn', 'ChartNoAxesCombined', 'ChartPie', 'ChartScatter', 'ChartSpline', 'LineChart', 'PieChart', 'ScatterChart',

  // Project Management
  'Activity', 'AlarmCheck', 'BadgeCheck', 'CalendarCheck2', 'CalendarMinus', 'CalendarOff', 'CalendarSync', 'Check',
  'CheckCheck', 'CheckCircle', 'CheckCircle2', 'CheckSquare', 'CheckSquare2', 'CircleCheck', 'CircleCheckBig', 'Clipboard',
  'ClipboardCheck', 'ClipboardCopy', 'ClipboardList', 'ClipboardMinus', 'ClipboardPaste', 'ClipboardPen', 'ClipboardPenLine', 'ClipboardPlus',
  'ClipboardType', 'ClipboardX', 'Flag', 'FlagOff', 'FlagTriangleLeft', 'FlagTriangleRight', 'GanttChart', 'GanttChartSquare',
  'Gauge', 'Goal', 'Kanban', 'KanbanSquare', 'KanbanSquareDashed', 'List', 'ListCheck', 'ListChecks',
  'ListCollapse', 'ListFilter', 'ListMinus', 'ListOrdered', 'ListPlus', 'ListTodo', 'ListTree', 'ListX',
  'Milestone', 'Projector', 'SquareActivity', 'SquareChartGantt', 'SquareCheck', 'SquareCheckBig', 'SquareDashedKanban', 'SquareGanttChart',
  'SquareKanban', 'Table', 'Table2', 'TableOfContents', 'TableProperties', 'Target', 'Timer', 'TimerOff',
  'TimerReset', 'Workflow', 'Clock', 'ClockAlert', 'ClockCheck', 'ClockFading',

  // Software Development
  'AppWindow', 'AppWindowMac', 'Archive', 'ArchiveRestore', 'ArchiveX', 'Binary', 'Blocks', 'Bluetooth',
  'Box', 'BoxSelect', 'Boxes', 'Bug', 'BugOff', 'BugPlay', 'Code', 'Code2',
  'CodeSquare', 'CodeXml', 'Command', 'Container', 'Copy', 'CopyCheck', 'CopyMinus', 'CopyPlus',
  'CopySlash', 'CopyX', 'Cpu', 'Crown', 'CurlyBraces', 'Database', 'DatabaseBackup', 'DatabaseZap',
  'Diff', 'Download', 'DownloadCloud', 'File', 'FileArchive', 'FileAudio', 'FileAudio2', 'FileBadge',
  'FileBadge2', 'FileBox', 'FileCheck', 'FileCheck2', 'FileClock', 'FileCode', 'FileCode2', 'FileCog',
  'FileDiff', 'FileDigit', 'FileDown', 'FileEdit', 'FileImage', 'FileInput', 'FileJson', 'FileJson2',
  'FileKey', 'FileLock', 'FileLock2', 'FileMinus', 'FileMinus2', 'FileOutput', 'FilePlus', 'FilePlus2',
  'FileQuestion', 'FileScan', 'FileSearch', 'FileSearch2', 'FileSignature', 'FileSliders', 'FileStack', 'FileSymlink',
  'FileTerminal', 'FileText', 'FileType', 'FileType2', 'FileUp', 'FileUser', 'FileVideo', 'FileVideo2',
  'FileVolume', 'FileVolume2', 'FileWarning', 'FileX', 'FileX2', 'Files', 'Filter', 'FilterX',
  'Fingerprint', 'Folder', 'FolderArchive', 'FolderCheck', 'FolderClock', 'FolderClosed', 'FolderCode', 'FolderCog',
  'FolderDot', 'FolderDown', 'FolderEdit', 'FolderGit', 'FolderGit2', 'FolderInput', 'FolderKanban', 'FolderKey',
  'FolderLock', 'FolderMinus', 'FolderOpen', 'FolderOutput', 'FolderPlus', 'FolderRoot', 'FolderSearch', 'FolderSymlink',
  'FolderSync', 'FolderTree', 'FolderUp', 'FolderX', 'Folders', 'GitBranch', 'GitBranchPlus', 'GitCommit',
  'GitCommitHorizontal', 'GitCompare', 'GitCompareArrows', 'GitFork', 'GitGraph', 'GitMerge', 'GitPullRequest', 'GitPullRequestArrow',
  'GitPullRequestClosed', 'GitPullRequestCreate', 'GitPullRequestCreateArrow', 'GitPullRequestDraft', 'Hammer', 'HardDriveDownload', 'HardDriveUpload', 'Import',
  'Key', 'KeyRound', 'KeySquare', 'Laptop2', 'LaptopMinimal', 'LaptopMinimalCheck', 'Lock', 'LockKeyhole',
  'MailSearch', 'MemoryStick', 'Menu', 'Merge', 'Microchip', 'MonitorCheck', 'MonitorDot', 'MonitorDown',
  'MonitorOff', 'MonitorPause', 'MonitorPlay', 'MonitorSmartphone', 'MonitorSpeaker', 'MonitorStop', 'MonitorUp', 'MonitorX',
  'Mouse', 'MousePointer', 'MousePointer2', 'MousePointerClick', 'Network', 'Package', 'Package2', 'PackageCheck',
  'PackageMinus', 'PackagePlus', 'PackageSearch', 'PackageX', 'Puzzle', 'QrCode', 'Redo', 'Redo2',
  'RefreshCcw', 'RefreshCw', 'RotateCcw', 'Scan', 'ScanBarcode', 'ScanEye', 'ScanLine', 'ScanQrCode',
  'ScanSearch', 'ScanText', 'ScreenShare', 'ScreenShareOff', 'SearchCheck', 'SearchCode', 'SearchSlash', 'SearchX',
  'Server', 'ServerCog', 'ServerCrash', 'ServerOff', 'Settings', 'Settings2', 'Shell', 'Shield',
  'ShieldAlert', 'ShieldBan', 'ShieldCheck', 'ShieldClose', 'ShieldCog', 'ShieldHalf', 'ShieldMinus', 'ShieldOff',
  'ShieldPlus', 'ShieldQuestion', 'ShieldUser', 'ShieldX', 'Slash', 'SmartphoneCharging', 'SquareCode', 'SquareTerminal',
  'Tablets', 'Tag', 'Tags', 'Terminal', 'TerminalSquare', 'TestTube', 'TestTube2', 'TestTubes',
  'ToolCase', 'Trash', 'Trash2', 'Undo', 'Undo2', 'Unlock', 'UnlockKeyhole', 'Upload',
  'UploadCloud', 'Usb', 'Webhook', 'WebhookOff', 'WifiHigh', 'WifiLow', 'WifiOff', 'ZoomIn',
  'ZoomOut', 'Layout', 'LayoutDashboard', 'LayoutGrid', 'LayoutList', 'LayoutPanelLeft', 'LayoutTemplate', 'Grid',
  'Grid2X2', 'Grid3X3', 'Columns', 'Columns2', 'Columns3', 'Columns4', 'Rows', 'Rows2',
  'Rows3', 'Rows4',

  // General / Interface
  'Anchor', 'ArrowDown', 'ArrowDownCircle', 'ArrowDownLeft', 'ArrowDownRight', 'ArrowDownUp', 'ArrowLeft', 'ArrowLeftCircle',
  'ArrowLeftRight', 'ArrowRight', 'ArrowRightCircle', 'ArrowRightLeft', 'ArrowUp', 'ArrowUpCircle', 'ArrowUpDown', 'Battery',
  'BatteryCharging', 'BatteryFull', 'BatteryLow', 'BatteryMedium', 'BatteryWarning', 'BellDot', 'BellMinus', 'BellOff',
  'BellPlus', 'BellRing', 'Bolt', 'Briefcase', 'BriefcaseBusiness', 'Building', 'Building2', 'CalendarClock',
  'Camera', 'CameraOff', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'Cloud', 'CloudDownload',
  'CloudOff', 'CloudUpload', 'CreditCard', 'DollarSign', 'Edit', 'Eye', 'EyeOff', 'Handshake',
  'Heart', 'Home', 'Info', 'Landmark', 'Layers', 'Link', 'MessageCircle', 'MessageSquare',
  'Minimize', 'Maximize', 'Moon', 'MoreHorizontal', 'MoreVertical', 'Phone', 'Plus', 'Minus',
  'Power', 'PowerOff', 'Rocket', 'Save', 'Send', 'Share', 'Share2', 'Smile',
  'Star', 'Sun', 'ThumbsDown', 'ThumbsUp', 'TrendingDown', 'TrendingUp', 'Tv', 'Umbrella',
  'User', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'VideoOff', 'Voicemail', 'Volume',
  'Volume1', 'Volume2', 'VolumeX', 'Wallet', 'X',
];
```

And update the placeholder on line 63 from:

```js
placeholder="Search 100+ icons..."
```

To:

```js
placeholder="Search 500+ icons..."
```

- [ ] **Step 2: Verify all icon names exist in lucide-react**

Run:
```bash
node -e "const icons = require('lucide-react'); /* copy the ICON_LIST from above and filter */"
```
Expected: All entries pass VALID_ICONS, zero invalid returned.

- [ ] **Step 3: Run the client build to verify no compilation errors**

Run:
```bash
npm run build
```
Workdir: `client/`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Verify seeded category icons still display**

Open the admin feature form page (`/admin/features/new`). Confirm these icons still render when selecting categories:
- Mobile App → `Smartphone`
- Student Portal → `Layout`
- LMS (Canvas) → `GraduationCap`
- Campus Tech → `Wifi`
- ServiceNow → `Briefcase`

- [ ] **Step 5: Commit**

```bash
git add client/src/components/IconPicker.jsx
git commit -m "feat: expand icon picker to 533 curated lucide icons across 4 themes"
```
