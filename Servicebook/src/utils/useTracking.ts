import { useEffect } from 'react';
import { activityTracker } from './cookieManager';

export const useTrackPageVisit = (pageName: string) => {
  useEffect(() => {
    activityTracker.trackPageVisit(pageName);
  }, [pageName]);
};

export const useTrackClick = (elementName: string) => {
  return () => activityTracker.trackClick(elementName);
};

export const useGetActivity = () => {
  return activityTracker.getActivity();
};
