import type {
  CmsWorkspaceDefinition,
  CmsWorkspaceFilter,
  CmsWorkspaceRecord,
  CmsWorkspaceRoute,
  CmsWorkspaceTone,
} from './workspace-types'

const record = (
  id: string,
  cells: string[],
  group: string,
  status: string,
  tone: CmsWorkspaceTone,
): CmsWorkspaceRecord => ({ id, cells, group, status, tone })

const allFilter: CmsWorkspaceFilter = { value: 'all', label: 'All' }

export const CMS_WORKSPACE_DEFINITIONS: Readonly<
  Record<CmsWorkspaceRoute, CmsWorkspaceDefinition>
> = {
  articles: {
    key: 'articles',
    title: 'Articles',
    description:
      'Search the editorial queue, narrow it by lifecycle, create drafts, and publish or unpublish an article.',
    columns: ['Title', 'Author', 'Updated'],
    filters: [
      allFilter,
      { value: 'Draft', label: 'Drafts' },
      { value: 'Published', label: 'Published' },
      { value: 'Scheduled', label: 'Scheduled' },
    ],
    searchPlaceholder: 'Search articles…',
    primaryActionLabel: 'Create draft',
    rowActionLabel: 'Toggle publish',
    emptyMessage: 'No articles match this editorial view.',
    records: [
      record(
        'article-designing-ai',
        ['Designing an AI-native UI', 'Ada Lovelace', '12 min ago'],
        'Published',
        'Published',
        'success',
      ),
      record(
        'article-token-migration',
        ['Token migration playbook', 'Grace Hopper', 'Yesterday'],
        'Draft',
        'Draft',
        'warning',
      ),
      record(
        'article-release-notes',
        ['July release notes', 'Alan Turing', 'Jul 29'],
        'Scheduled',
        'Scheduled',
        'primary',
      ),
    ],
  },
  categories: {
    key: 'categories',
    title: 'Categories',
    description:
      'Maintain the content taxonomy, find a category, create a collection, and attach articles to it.',
    columns: ['Name', 'Slug', 'Articles'],
    filters: [allFilter, { value: 'Active', label: 'Active' }, { value: 'Empty', label: 'Empty' }],
    searchPlaceholder: 'Search categories…',
    primaryActionLabel: 'Add category',
    rowActionLabel: 'Add article',
    emptyMessage: 'No categories match this taxonomy view.',
    records: [
      record('category-product', ['Product', 'product', '42'], 'Active', 'Active', 'success'),
      record(
        'category-engineering',
        ['Engineering', 'engineering', '28'],
        'Active',
        'Active',
        'success',
      ),
      record(
        'category-field-notes',
        ['Field notes', 'field-notes', '0'],
        'Empty',
        'Empty',
        'neutral',
      ),
    ],
  },
  media: {
    key: 'media',
    title: 'Media library',
    description:
      'Inspect uploaded assets by type, add a sample upload, and archive or restore individual files.',
    columns: ['Asset', 'Type', 'Size'],
    filters: [
      allFilter,
      { value: 'Image', label: 'Images' },
      { value: 'Video', label: 'Videos' },
      { value: 'Document', label: 'Documents' },
    ],
    searchPlaceholder: 'Search media…',
    primaryActionLabel: 'Upload sample',
    rowActionLabel: 'Archive / restore',
    emptyMessage: 'No media assets match this library view.',
    records: [
      record('media-hero', ['hero-dashboard.webp', 'Image', '842 KB'], 'Image', 'Ready', 'success'),
      record('media-demo', ['product-tour.mp4', 'Video', '18.4 MB'], 'Video', 'Ready', 'success'),
      record(
        'media-brand',
        ['brand-guidelines.pdf', 'Document', '2.1 MB'],
        'Document',
        'Ready',
        'success',
      ),
    ],
  },
  roles: {
    key: 'roles',
    title: 'Roles & access',
    description:
      'Review member reach by role, create a custom role, and switch each role between limited and full access.',
    columns: ['Role', 'Members', 'Access'],
    filters: [
      allFilter,
      { value: 'System', label: 'System roles' },
      { value: 'Custom', label: 'Custom roles' },
    ],
    searchPlaceholder: 'Search roles…',
    primaryActionLabel: 'Create role',
    rowActionLabel: 'Toggle access',
    emptyMessage: 'No roles match this access view.',
    records: [
      record('role-owner', ['Owner', '2', 'Full'], 'System', 'Full access', 'success'),
      record('role-editor', ['Editor', '8', 'Limited'], 'System', 'Limited', 'warning'),
      record('role-reviewer', ['Reviewer', '4', 'Limited'], 'Custom', 'Limited', 'warning'),
    ],
  },
  overview: {
    key: 'overview',
    title: 'Analytics overview',
    description:
      'Compare acquisition channels, filter the live summary, inspect a channel, and refresh the headline metrics.',
    columns: ['Channel', 'Sessions', 'Conversion'],
    filters: [
      allFilter,
      { value: 'Owned', label: 'Owned' },
      { value: 'Earned', label: 'Earned' },
      { value: 'Paid', label: 'Paid' },
    ],
    searchPlaceholder: 'Search channels…',
    primaryActionLabel: 'Refresh metrics',
    rowActionLabel: 'Inspect channel',
    emptyMessage: 'No channels match this analytics view.',
    metrics: [
      { label: 'Sessions', value: '24.8k', delta: '+8.4%', tone: 'primary' },
      { label: 'Engagement', value: '68%', delta: '+3.1%', tone: 'success' },
      { label: 'Conversion', value: '4.7%', delta: '+0.6%', tone: 'warning' },
    ],
    records: [
      record(
        'channel-search',
        ['Organic search', '12,420', '5.2%'],
        'Earned',
        'Healthy',
        'success',
      ),
      record('channel-email', ['Email', '6,180', '6.8%'], 'Owned', 'Healthy', 'success'),
      record('channel-paid', ['Paid social', '3,940', '2.1%'], 'Paid', 'Watch', 'warning'),
    ],
  },
  reports: {
    key: 'reports',
    title: 'Reports',
    description:
      'Track scheduled deliverables, generate an ad-hoc report, and run any report immediately.',
    columns: ['Report', 'Owner', 'Schedule'],
    filters: [
      allFilter,
      { value: 'Scheduled', label: 'Scheduled' },
      { value: 'Manual', label: 'Manual' },
    ],
    searchPlaceholder: 'Search reports…',
    primaryActionLabel: 'Generate report',
    rowActionLabel: 'Run now',
    emptyMessage: 'No reports match this delivery view.',
    records: [
      record(
        'report-executive',
        ['Executive summary', 'Ada Lovelace', 'Every Monday'],
        'Scheduled',
        'Ready',
        'success',
      ),
      record(
        'report-content',
        ['Content performance', 'Grace Hopper', 'Monthly'],
        'Scheduled',
        'Ready',
        'success',
      ),
      record(
        'report-acquisition',
        ['Acquisition snapshot', 'Alan Turing', 'On demand'],
        'Manual',
        'Ready',
        'neutral',
      ),
    ],
  },
  calendar: {
    key: 'calendar',
    title: 'Calendar',
    description:
      'Move through the editorial calendar, filter events by team, add an event, and reschedule work by one day.',
    columns: ['Event', 'Date', 'Team'],
    filters: [
      allFilter,
      { value: 'Content', label: 'Content' },
      { value: 'Product', label: 'Product' },
      { value: 'Growth', label: 'Growth' },
    ],
    searchPlaceholder: 'Search events…',
    primaryActionLabel: 'Add event',
    rowActionLabel: 'Move one day',
    emptyMessage: 'No events match this calendar view.',
    periods: ['June 2026', 'July 2026', 'August 2026'],
    records: [
      record(
        'event-release',
        ['July release', 'Jul 29', 'Product'],
        'Product',
        'Confirmed',
        'success',
      ),
      record(
        'event-newsletter',
        ['Customer newsletter', 'Jul 30', 'Growth'],
        'Growth',
        'Planned',
        'primary',
      ),
      record(
        'event-review',
        ['Editorial review', 'Aug 02', 'Content'],
        'Content',
        'Planned',
        'primary',
      ),
    ],
  },
  'audit-log': {
    key: 'audit-log',
    title: 'Audit log',
    description:
      'Trace administrative changes, filter by result, export the visible trail, and mark an entry reviewed.',
    columns: ['Actor', 'Action', 'Time'],
    filters: [
      allFilter,
      { value: 'Success', label: 'Successful' },
      { value: 'Attention', label: 'Needs attention' },
    ],
    searchPlaceholder: 'Search audit events…',
    primaryActionLabel: 'Export visible',
    rowActionLabel: 'Mark reviewed',
    emptyMessage: 'No audit events match this trail.',
    records: [
      record(
        'audit-role',
        ['Ada Lovelace', 'Updated Editor access', '10:42'],
        'Success',
        'Success',
        'success',
      ),
      record(
        'audit-media',
        ['Alan Turing', 'Archived product-tour.mp4', '09:18'],
        'Success',
        'Success',
        'success',
      ),
      record(
        'audit-login',
        ['System', 'Blocked repeated login', '08:57'],
        'Attention',
        'Attention',
        'warning',
      ),
    ],
  },
}
