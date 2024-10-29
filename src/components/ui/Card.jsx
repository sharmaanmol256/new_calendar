// src/components/ui/card.jsx
const Card = ({ children, className = "" }) => {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        {children}
      </div>
    );
  };
  
  const CardHeader = ({ children, className = "" }) => {
    return <div className={`mb-4 ${className}`}>{children}</div>;
  };
  
  const CardTitle = ({ children, className = "" }) => {
    return <h3 className={`text-2xl font-bold ${className}`}>{children}</h3>;
  };
  
  const CardContent = ({ children, className = "" }) => {
    return <div className={className}>{children}</div>;
  };
  
  export { Card, CardHeader, CardTitle, CardContent };