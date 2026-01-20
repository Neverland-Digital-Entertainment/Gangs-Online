import { Suspense } from 'react';
import EditItemContent from './EditItemContent';

export default function EditItemPage() {
  return (
    <Suspense
      fallback={
        <div className="container-fixed">
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      }
    >
      <EditItemContent />
    </Suspense>
  );
}
