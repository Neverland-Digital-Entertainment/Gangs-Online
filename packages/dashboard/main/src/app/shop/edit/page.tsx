import { Suspense } from 'react';
import EditShopContent from './EditShopContent';

export default function EditShopPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      }
    >
      <EditShopContent />
    </Suspense>
  );
}
