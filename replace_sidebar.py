import os
import re

files = [
    "Servicebook/src/app/components/firm/FirmDashboard.tsx",
    "Servicebook/src/app/components/firm/FirmAnalytics.tsx",
    "Servicebook/src/app/components/firm/FirmEmployees.tsx",
    "Servicebook/src/app/components/firm/FirmSettings.tsx",
    "Servicebook/src/app/components/firm/AdminDashboard.tsx",
]

for file_path in files:
    if not os.path.exists(file_path):
        print(f"Not found: {file_path}")
        continue
    with open(file_path, "r") as f:
        content = f.read()

    content = content.replace("navigate('/firm/login')", "navigate('/')")

    if "FirmSidebar" not in content:
        content = content.replace("export function ", "import { FirmSidebar } from './FirmSidebar';\n\nexport function ")

    # The sidebar always starts with {/* Left Sidebar - Navigation */}
    # and is followed by another comment like {/* Main Content */}
    new_content = re.sub(
        r'\{/\* Left Sidebar - Navigation \*/\}.*?(?=\{/\* )',
        '<FirmSidebar />\n\n      ',
        content,
        flags=re.DOTALL
    )

    with open(file_path, "w") as f:
        f.write(new_content)

print("Replacement complete")
