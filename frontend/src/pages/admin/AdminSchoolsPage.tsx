import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { api, apiErrorMessage } from "../../api/client";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonBlock } from "../../components/ui/Skeleton";

interface SchoolRow {
  id: string;
  school_name: string;
  province: string;
  district: string;
  contact_email: string;
}

export function AdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .get<SchoolRow[]>("/api/admin/schools")
      .then((res) => setSchools(res.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const filtered = (schools ?? []).filter(
    (s) =>
      s.school_name.toLowerCase().includes(query.toLowerCase()) ||
      s.province.toLowerCase().includes(query.toLowerCase()) ||
      s.district.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1">Schools</h1>
          <p className="text-muted" style={{ margin: 0 }}>All registered school accounts across every competition.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {schools === null && !error && <SkeletonBlock height={320} />}

      {schools && (
        <div className="card">
          <div className="form-group" style={{ maxWidth: 320, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-faint)" }}>
              <Search size={16} />
            </span>
            <input style={{ paddingLeft: 36 }} placeholder="Search by name, province, district" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Users size={24} />} title="No schools found" description="No school accounts match your search yet." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Province</th>
                    <th>District</th>
                    <th>Contact Email</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.school_name}</td>
                      <td>{s.province}</td>
                      <td>{s.district}</td>
                      <td>{s.contact_email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
