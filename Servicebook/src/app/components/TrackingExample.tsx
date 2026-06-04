import { useTrackPageVisit, useTrackClick, useGetActivity } from '@/utils/useTracking';

/**
 * Example component showing how to use the activity tracking system
 */
export function TrackingExample() {
  // Track this page when component mounts (1 line!)
  useTrackPageVisit('Tracking Example Page');

  // Get all tracked activity
  const activity = useGetActivity();

  // Create click handlers with tracking
  const handleSearchClick = useTrackClick('example-search-btn');
  const handleSubmitClick = useTrackClick('example-submit-btn');

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Activity Tracking Example</h1>

      {/* Display tracked activity */}
      <section className="border rounded-lg p-4 bg-blue-50">
        <h2 className="text-xl font-semibold mb-2">Your Activity</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <strong>Total Visits:</strong> {activity.visitCount}
          </li>
          <li>
            <strong>Last Page:</strong> {activity.lastPage || 'None'}
          </li>
          <li>
            <strong>Pages Visited:</strong>{' '}
            {activity.visitedPages.length > 0 ? activity.visitedPages.join(', ') : 'None'}
          </li>
          <li>
            <strong>Clicks Tracked:</strong> {Object.keys(activity.clicks).length}
          </li>
        </ul>
      </section>

      {/* Tracked buttons */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Click These Buttons (tracked)</h2>
        <button
          onClick={handleSearchClick}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Search (Tracked)
        </button>
        <button
          onClick={handleSubmitClick}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ml-2"
        >
          Submit (Tracked)
        </button>
      </section>

      {/* Console tip */}
      <p className="text-sm text-gray-600 border-l-4 border-yellow-400 pl-4">
        💡 Open browser console and paste: <code>window.activityTracker.getActivity()</code> to see
        all tracked data in real-time!
      </p>
    </div>
  );
}
