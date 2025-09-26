import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ReactSelect from "react-select";
import { MapPin, Users, Building2 } from "lucide-react";

interface Manager {
  id: string;
  name: string;
  email: string;
  role: 'regional_manager' | 'district_manager' | 'manager' | 'assistant_manager' | 'staff' | 'admin';
  region_id?: string;
  district_id?: string;
  branch_assignments?: string[];
}

interface Branch {
  id: string;
  name: string;
  region_id: string;
  district_id?: string;
  manager_id?: string;
  region_name?: string;
  district_name?: string;
  manager_name?: string;
}

interface Region {
  id: string;
  name: string;
  regional_manager_id?: string;
}

interface District {
  id: string;
  name: string;
  region_id: string;
}

const BranchAssignments = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  const selectStyles: any = {
    container: (base: any) => ({ ...base, zIndex: 999999 }),
    menuPortal: (base: any) => ({ ...base, zIndex: 999999, pointerEvents: 'auto' }),
    menu: (base: any) => ({ ...base, zIndex: 999999, backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }),
    menuList: (base: any) => ({ ...base, zIndex: 999999 }),
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none'
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'hsl(var(--popover))',
      color: 'hsl(var(--popover-foreground))'
    })
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch regions
      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select('id, name, regional_manager_id')
        .order('name');

      if (regionsError) throw regionsError;
      setRegions(regionsData || []);

      // Fetch districts
      const { data: districtsData, error: districtsError } = await supabase
        .from('districts')
        .select('id, name, region_id')
        .order('name');

      if (districtsError) throw districtsError;
      setDistricts(districtsData || []);

      // Fetch managers (regional and district managers)
      const { data: managersData, error: managersError } = await supabase
        .from('profiles')
        .select('id, name, email, role, region_id, district_id')
        .in('role', ['regional_manager', 'district_manager'])
        .order('name');

      if (managersError) throw managersError;
      setManagers(managersData || []);

      // Fetch branches with their assignments
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select(`
          id, 
          name, 
          region_id, 
          district_id, 
          manager_id,
          regions (name),
          districts (name),
          profiles (name)
        `)
        .order('name');

      if (branchesError) throw branchesError;
      
      const branchesWithNames = branchesData?.map(branch => ({
        ...branch,
        region_name: (branch.regions as any)?.name,
        district_name: (branch.districts as any)?.name,
        manager_name: (branch.profiles as any)?.name
      })) || [];

      setBranches(branchesWithNames);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManagerSelect = (manager: Manager) => {
    setSelectedManager(manager);
    // Get currently assigned branches for this manager
    const assignedBranches = branches
      .filter(branch => branch.manager_id === manager.id)
      .map(branch => branch.id);
    setSelectedBranches(assignedBranches);
  };

  const handleAssignBranches = async () => {
    if (!selectedManager) return;

    try {
      // First, remove this manager from all branches
      await supabase
        .from('branches')
        .update({ manager_id: null })
        .eq('manager_id', selectedManager.id);

      // Then assign selected branches to this manager
      if (selectedBranches.length > 0) {
        await supabase
          .from('branches')
          .update({ manager_id: selectedManager.id })
          .in('id', selectedBranches);
      }

      // Update manager's branch context for quick access
      const branchContext = selectedBranches.length > 0 ? selectedBranches[0] : null;
      await supabase
        .from('profiles')
        .update({ branch_context: branchContext })
        .eq('id', selectedManager.id);

      toast({
        title: "Success",
        description: "Branch assignments updated successfully",
      });

      // Refresh data
      fetchData();
      setSelectedManager(null);
      setSelectedBranches([]);
    } catch (error) {
      console.error('Error updating branch assignments:', error);
      toast({
        title: "Error",
        description: "Failed to update branch assignments",
        variant: "destructive",
      });
    }
  };

  const getAvailableBranches = () => {
    if (!selectedManager) return [];

    if (selectedManager.role === 'regional_manager') {
      // Find region where this manager is assigned as regional manager
      const managerRegion = regions.find(region => region.regional_manager_id === selectedManager.id);
      if (managerRegion) {
        return branches.filter(branch => branch.region_id === managerRegion.id);
      }
      // Fallback: if region_id is set directly on the manager profile
      if (selectedManager.region_id) {
        return branches.filter(branch => branch.region_id === selectedManager.region_id);
      }
    } else if (selectedManager.role === 'district_manager') {
      return branches.filter(branch => branch.district_id === selectedManager.district_id);
    }

    return [];
  };

  const branchOptions = getAvailableBranches().map(branch => ({
    value: branch.id,
    label: `${branch.name} (${branch.district_name || 'No District'})`
  }));

  useEffect(() => {
    if (profile && (profile.role as string) === 'admin') {
      fetchData();
    }
  }, [profile?.role]);

  if (!profile || (profile.role as string) !== 'admin') {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branch Assignments</h1>
          <p className="text-muted-foreground">Assign branches to regional and district managers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manager Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Manager</Label>
              <ReactSelect
                options={managers.map(manager => ({
                  value: manager.id,
                  label: `${manager.name} (${manager.role.replace('_', ' ').toUpperCase()})`
                }))}
                value={selectedManager ? {
                  value: selectedManager.id,
                  label: `${selectedManager.name} (${selectedManager.role.replace('_', ' ').toUpperCase()})`
                } : null}
                onChange={(option) => {
                  const manager = managers.find(m => m.id === option?.value);
                  if (manager) handleManagerSelect(manager);
                }}
                placeholder="Select a manager..."
                isClearable
                styles={selectStyles}
                menuPortalTarget={document.body}
              />
            </div>

            {selectedManager && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Assign Branches</Label>
                  <ReactSelect
                    isMulti
                    options={branchOptions}
                    value={branchOptions.filter(option => selectedBranches.includes(option.value))}
                    onChange={(options) => {
                      setSelectedBranches(options.map(option => option.value));
                    }}
                    placeholder="Select branches..."
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                  />
                </div>

                <Button onClick={handleAssignBranches} className="w-full">
                  Update Assignments
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Current Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {managers.map(manager => {
                const assignedBranches = branches.filter(branch => branch.manager_id === manager.id);
                return (
                  <div key={manager.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{manager.name}</h3>
                      <Badge variant="outline">
                        {manager.role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{manager.email}</div>
                    <div>
                      {assignedBranches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedBranches.map(branch => (
                            <Badge key={branch.id} variant="secondary" className="text-xs">
                              {branch.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No branches assigned</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Branches Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Branches</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch Name</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Assigned Manager</TableHead>
                <TableHead>Manager Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.region_name || '-'}</TableCell>
                  <TableCell>{branch.district_name || '-'}</TableCell>
                  <TableCell>{branch.manager_name || 'Unassigned'}</TableCell>
                  <TableCell>
                    {branch.manager_id && (
                      <Badge variant="outline">
                        {managers.find(m => m.id === branch.manager_id)?.role.replace('_', ' ').toUpperCase() || '-'}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BranchAssignments;