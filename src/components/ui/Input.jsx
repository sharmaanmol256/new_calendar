// src/components/ui/input.jsx
const Input = ({ type = "text", placeholder, value, onChange, className = "" }) => {
    return (
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
    );
  };
  
  export { Input };