import { Suspense } from 'react';
import EditInstanceContent from './EditInstanceContent';

export default function EditInstancePage() {
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
      <EditInstanceContent />
    </Suspense>
  );
}
