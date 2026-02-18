import { Spinner } from './Spinner.jsx';

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner />
    </div>
  );
}

