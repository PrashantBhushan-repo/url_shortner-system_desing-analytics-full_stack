// function Navbar() {
//   return (
//     <nav className="bg-white shadow-sm">
//       <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
//         <h1 className="text-2xl font-bold text-blue-600">
//           🔗 SnapURL
//         </h1>

//         <button className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
//           GitHub
//         </button>
//       </div>
//     </nav>
//   );
// }

// export default Navbar;

// const navItems = ["Home", "Analytics", "Dashboard",  "logout","profile"];

// function Navbar() {
//   return (
//     <nav className="bg-white shadow-sm">
//       <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
//         <h1 className="text-2xl font-bold text-blue-600">🔗 SnapURL</h1>

//         <div className="flex items-center gap-6">
//           {navItems.map((item) => (
//             <button
//               key={item}
// className="text-gray-700 hover:text-blue-600 font-medium"
//               className="
// relative
// text-gray-600
// font-medium
// transition-colors
// duration-200
// hover:text-blue-600
// after:absolute
// after:left-0
// after:-bottom-1
// after:h-0.5
// after:w-0
// after:bg-blue-600
// after:transition-all
// after:duration-300
// hover:after:w-full
// "
// className="
// px-3
// py-2
// rounded-md
// text-gray-600
// font-medium
// transition-all
// duration-200
// hover:text-blue-600
// hover:bg-gray-100
// active:scale-95
// "
//             >
//               {item}
//             </button>
//           ))}

//           <button className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
//             GitHub
//           </button>
//         </div>
//       </div>
//     </nav>
//   );
// }

// export default Navbar;

import { useState } from "react";
import {
  UserCircle,
  Settings,
  LogOut,
  BarChart3,
  ChevronDown,
  GitBranch,
} from "lucide-react";

const navItems = [
  {
    name: "Home",
    href: "/",
  },
  {
    name: "Analytics",
    href: "/analytics",
  },
];

function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
        {/* Logo */}

        <h1 className="text-2xl font-bold text-blue-600 cursor-pointer select-none">
          🔗 SnapURL
        </h1>

        {/* Right Side */}

        <div className="flex items-center gap-3">
          {/* Navigation */}

          {navItems.map((item) => (
            <button
              key={item.name}
              className="
                px-4
                py-2
                rounded-lg
                text-gray-600
                font-medium
                transition-all
                duration-200
                hover:bg-blue-50
                hover:text-blue-600
                active:scale-95
              "
            >
              {item.name}
            </button>
          ))}

          {/* GitBranch */}

          <button
            className="
              flex
              items-center
              gap-2
              px-4
              py-2
              rounded-lg
              bg-gray-900
              text-white
              hover:bg-gray-800
              transition
            "
          >
            <GitBranch size={18} />
           GitBranch
          </button>

          {/* Profile */}

          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="
                flex
                items-center
                gap-2
                px-3
                py-2
                rounded-lg
                hover:bg-gray-100
                transition
              "
            >
              <UserCircle size={34} className="text-gray-700" />

              <ChevronDown
                size={18}
                className={`transition ${open ? "rotate-180" : ""}`}
              />
            </button>

            {open && (
              <div
                className="
                  absolute
                  right-0
                  mt-3
                  w-56
                  rounded-xl
                  bg-white
                  shadow-xl
                  border
                  border-gray-200
                  overflow-hidden
                "
              >
                <button
                  className="
                    w-full
                    flex
                    items-center
                    gap-3
                    px-4
                    py-3
                    hover:bg-gray-50
                    transition
                  "
                >
                  <UserCircle size={20} />
                  My Profile
                </button>

                {/* <button
                  className="
                    w-full
                    flex
                    items-center
                    gap-3
                    px-4
                    py-3
                    hover:bg-gray-50
                    transition
                  "
                >
                  <BarChart3 size={20} />
                  Analytics
                </button> */}

                <button
                  className="
                    w-full
                    flex
                    items-center
                    gap-3
                    px-4
                    py-3
                    hover:bg-gray-50
                    transition
                  "
                >
                  <Settings size={20} />
                  Settings
                </button>

                <div className="border-t"></div>

                <button
                  className="
                    w-full
                    flex
                    items-center
                    gap-3
                    px-4
                    py-3
                    text-red-600
                    hover:bg-red-50
                    transition
                  "
                >
                  <LogOut size={20} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
