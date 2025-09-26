import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactSelect from "react-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Plus, Edit, Trash2, Search, UserPlus } from "lucide-react";
import { z } from "zod";

interface StaffMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  position?: string;
  role: 'regional_manager' | 'district_manager' | 'manager' | 'assistant_manager' | 'staff';
  branch_id?: string;
  region_id?: string;
  district_id?: string;
  last_access?: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().optional(),
  position: z.string().optional(),
  role: z.enum(['regional_manager', 'district_manager', 'manager', 'assistant_manager', 'staff'], {
    required_error: "Role is required"
  }),
  photo_url: z.string().url().optional().or(z.literal("")),
  // Allow empty string to keep current password during edits
  password: z.union([z.literal(""), z.string().min(6, "Password must be at least 6 characters")])
});

const Staff = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    role: "staff" as 'regional_manager' | 'district_manager' | 'manager' | 'assistant_manager' | 'staff',
    photo_url: "",
    password: ""
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string; region_id: string }[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<{ id: string; name: string; region_id: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");

  const roleOptions = [
    { value: 'regional_manager', label: 'Regional Manager' },
    { value: 'district_manager', label: 'District Manager' },
    { value: 'manager', label: 'Manager' },
    { value: 'assistant_manager', label: 'Assistant Manager' },
    { value: 'staff', label: 'Staff' },
  ];

  const allowedRolesByCreator: Record<string, Array<StaffMember['role']>> = {
    admin: ['regional_manager','district_manager','manager','assistant_manager','staff'],
    regional_manager: ['district_manager','manager','assistant_manager','staff'],
    district_manager: ['manager','assistant_manager','staff'],
    manager: ['assistant_manager','staff'],
    assistant_manager: ['staff'],
    staff: []
  };

  const allowedRoleValues = allowedRolesByCreator[profile?.role as string] || [];
  const allowedRoleOptions = roleOptions.filter((o) => (allowedRoleValues as string[]).includes(o.value));

  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }));
  const regionOptions = regions.map(r => ({ value: r.id, label: r.name }));
  const districtOptions = filteredDistricts.map(d => ({ value: d.id, label: d.name }));

  // Filter districts based on selected region
  useEffect(() => {
    if (selectedRegionId) {
      const regionDistricts = districts.filter(d => d.region_id === selectedRegionId);
      setFilteredDistricts(regionDistricts);
      // Clear district selection if current district doesn't belong to selected region
      if (selectedDistrictId && !regionDistricts.find(d => d.id === selectedDistrictId)) {
        setSelectedDistrictId('');
      }
    } else {
      setFilteredDistricts([]);
      setSelectedDistrictId('');
    }
  }, [selectedRegionId, districts, selectedDistrictId]);

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

  const fetchStaffMembers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          name,
          email,
          phone,
          photo_url,
          position,
          role,
          branch_id,
          access_count,
          created_at,
          updated_at,
          branches (
            name
          )
        `)
        .order('created_at', { ascending: false });

      // Define role hierarchy - users can only see lower level users
      const roleHierarchy: Record<string, string[]> = {
        'admin': ['regional_manager', 'district_manager', 'manager', 'assistant_manager', 'staff'],
        'regional_manager': ['district_manager', 'manager', 'assistant_manager', 'staff'],
        'district_manager': ['manager', 'assistant_manager', 'staff'],
        'manager': ['assistant_manager', 'staff'],
        'assistant_manager': ['staff'],
        'staff': []
      };

      // Filter staff based on user role hierarchy
      const userRole = profile.role as string;
      const allowedRoles = roleHierarchy[userRole] || [];
      
      if (userRole !== 'admin') {
        // Filter by allowed roles based on hierarchy
        query = query.in('role', allowedRoles);
        
        // Also filter by branch for non-regional/district managers
        if (userRole !== 'regional_manager' && userRole !== 'district_manager') {
          const userBranchId = profile.branch_id || profile.branch_context;
          if (userBranchId) {
            query = query.eq('branch_id', userBranchId);
          }
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching staff:', error);
        toast({
          title: "Error",
          description: "Failed to load staff members",
          variant: "destructive",
        });
        return;
      }

      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error in fetchStaffMembers:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    try {
      staffSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path) {
            errors[err.path[0]] = err.message;
          }
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (selectedStaff) {
        // Update existing staff member
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || null,
            position: formData.position.trim() || null,
            role: formData.role,
            photo_url: formData.photo_url.trim() || null,
            branch_id: selectedBranchId || null,
            region_id: selectedRegionId || null,
            district_id: selectedDistrictId || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedStaff.id);

        if (error) throw error;

        // Optionally update password if provided (>= 6 chars)
        if (formData.password && formData.password.length >= 6) {
          const { data: updData, error: updErr } = await supabase.functions.invoke('admin-update-user', {
            body: { user_id: selectedStaff.user_id, password: formData.password }
          });
          if (updErr || !updData?.success) {
            throw new Error(updErr?.message || updData?.error || 'Failed to update password');
          }
        }

        // Log activity
        try {
          await supabase.rpc('log_user_activity', {
            p_action: 'staff_updated',
            p_details: JSON.stringify({ staff_id: selectedStaff.id, role: formData.role })
          });
        } catch (logError) {
          console.warn('Failed to log staff update:', logError);
        }

        toast({
          title: "Success",
          description: "Staff member updated successfully",
        });
        setIsEditModalOpen(false);
      } else {
        // Create new staff member via backend function (requires password)
        const creatorRole = profile?.role as string;
        const requiredBranchId = (creatorRole === 'admin')
          ? selectedBranchId
          : ((creatorRole === 'regional_manager' || creatorRole === 'district_manager')
            ? (profile?.branch_context || selectedBranchId)
            : profile?.branch_id);

        if (!requiredBranchId) {
          toast({
            title: "Branch required",
            description: "Please select a branch for this staff member.",
            variant: "destructive",
          });
          return;
        }

        if (creatorRole !== 'staff' && (!formData.password || formData.password.length < 6)) {
          setFormErrors((prev) => ({ ...prev, password: 'Password must be at least 6 characters' }));
          toast({ title: 'Password required', description: 'Please provide a valid password for the new user.', variant: 'destructive' });
          return;
        }

        const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: formData.email.trim(),
            password: formData.password,
            name: formData.name.trim(),
            role: formData.role,
            branch_id: requiredBranchId,
            position: formData.position.trim() || null,
            phone: formData.phone.trim() || null,
            photo_url: formData.photo_url.trim() || null,
          }
        });

        if (fnError || !fnData?.success) {
          throw new Error(fnError?.message || fnData?.error || 'Failed to create user');
        }

        // Log activity
        try {
          await supabase.rpc('log_user_activity', {
            p_action: 'staff_created',
            p_details: JSON.stringify({ name: formData.name, role: formData.role })
          });
        } catch (logError) {
          console.warn('Failed to log staff creation:', logError);
        }

        toast({
          title: "Success",
          description: "Staff member created successfully",
        });
        setIsAddModalOpen(false);
      }

      fetchStaffMembers();
      resetForm();
    } catch (error) {
      console.error('Error saving staff member:', error);
      toast({
        title: "Error",
        description: "Failed to save staff member",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', staffId);

      if (error) throw error;

      // Log activity
      try {
        const branchId = profile?.branch_id || profile?.branch_context || '';
        await supabase.rpc('log_user_activity', {
          p_action: 'staff_deleted',
          p_details: JSON.stringify({ staff_id: staffId }),
          p_branch_id: branchId
        });
      } catch (logError) {
        console.warn('Failed to log staff deletion:', logError);
      }

      toast({
        title: "Success",
        description: "Staff member deleted successfully",
      });
      fetchStaffMembers();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      toast({
        title: "Error",
        description: "Failed to delete staff member",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      position: "",
      role: "staff" as 'regional_manager' | 'district_manager' | 'manager' | 'assistant_manager' | 'staff',
      photo_url: "",
      password: ""
    });
    setFormErrors({});
    setSelectedStaff(null);
  };

  const openEditModal = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setSelectedBranchId(staff.branch_id || "");
    setFormData({
      name: staff.name,
      email: staff.email,
      phone: staff.phone || "",
      position: staff.position || "",
      role: staff.role,
      photo_url: staff.photo_url || "",
      password: ""
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const filteredStaff = staffMembers.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageStaff = profile && ['admin', 'regional_manager', 'district_manager', 'manager', 'assistant_manager'].includes(profile.role);

  useEffect(() => {
    if (canManageStaff) {
      fetchStaffMembers();
      fetchRegions();
      fetchDistricts();
      // Load all branches for admin, regional managers, and district managers
      if ((profile.role as string) === 'admin' || profile.role === 'regional_manager' || profile.role === 'district_manager') {
        console.log('Fetching branches for admin/manager role:', profile.role);
        supabase
          .from('branches')
          .select('id,name')
          .order('name', { ascending: true })
          .then(({ data, error }) => {
            console.log('Branches fetch result:', { data, error });
            if (error) {
              console.error('Error fetching branches:', error);
              toast({
                title: "Error loading branches",
                description: error.message,
                variant: "destructive",
              });
            } else {
              setBranches(data || []);
              console.log('Branches set to state:', data);
            }
          });
      }
    }
  }, [canManageStaff, profile?.role]);

  const fetchRegions = async () => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setRegions(data || []);
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const fetchDistricts = async () => {
    try {
      const { data, error } = await supabase
        .from('districts')
        .select('id, name, region_id')
        .order('name');
      
      if (error) throw error;
      setDistricts(data || []);
    } catch (error) {
      console.error('Error fetching districts:', error);
    }
  };

  if (!canManageStaff) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">You don't have permission to manage staff.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading staff members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Staff</h1>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New Staff Member
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                    {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                    {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                    {formErrors.phone && <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>}
                  </div>

                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="e.g., Warehouse Assistant"
                    />
                    {formErrors.position && <p className="text-sm text-red-500 mt-1">{formErrors.position}</p>}
                  </div>
                </div>

                {/* Role and Location Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Role *</Label>
                    <ReactSelect
                      inputId="role"
                      classNamePrefix="rs"
                      options={allowedRoleOptions}
                      value={roleOptions.find(o => o.value === formData.role)}
                      onChange={(opt) => {
                        const val = (opt as any)?.value;
                        console.log('Role selected:', val);
                        setFormData({ ...formData, role: val });
                      }}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      menuShouldBlockScroll
                      placeholder="Select role"
                    />
                    {formErrors.role && <p className="text-sm text-red-500 mt-1">{formErrors.role}</p>}
                  </div>

                  {/* Regional Manager role selection */}
                  {formData.role === 'regional_manager' && (
                    <div>
                      <Label htmlFor="region">Region *</Label>
                      <ReactSelect
                        inputId="region"
                        classNamePrefix="rs"
                        options={regionOptions}
                        value={regionOptions.find(o => o.value === selectedRegionId) || null}
                        onChange={(opt) => setSelectedRegionId((opt as any)?.value || '')}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuShouldBlockScroll
                        placeholder="Select region"
                      />
                    </div>
                  )}

                  {/* District Manager role selection */}
                  {formData.role === 'district_manager' && (
                    <>
                      <div>
                        <Label htmlFor="region">Region *</Label>
                        <ReactSelect
                          inputId="region"
                          classNamePrefix="rs"
                          options={regionOptions}
                          value={regionOptions.find(o => o.value === selectedRegionId) || null}
                          onChange={(opt) => setSelectedRegionId((opt as any)?.value || '')}
                          styles={selectStyles}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                          menuShouldBlockScroll
                          placeholder="Select region"
                        />
                      </div>
                    </>
                  )}

                  {/* Regional Manager creating District Manager */}
                  {(profile?.role as string) === 'regional_manager' && formData.role === 'district_manager' && (
                    <div>
                      <Label htmlFor="district">District *</Label>
                      <ReactSelect
                        inputId="district"
                        classNamePrefix="rs"
                        options={districtOptions}
                        value={districtOptions.find(o => o.value === selectedDistrictId) || null}
                        onChange={(opt) => setSelectedDistrictId((opt as any)?.value || '')}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuShouldBlockScroll
                        placeholder="Select district"
                        isDisabled={!selectedRegionId}
                      />
                    </div>
                  )}

                  {/* Branch selection - show for admin and higher roles */}
                  {((profile?.role as string) === 'admin' || profile?.role === 'regional_manager' || profile?.role === 'district_manager') && (
                    <div>
                      <Label htmlFor="branch">Branch *</Label>
                      <ReactSelect
                        inputId="branch"
                        classNamePrefix="rs"
                        options={branchOptions}
                        value={branchOptions.find(o => o.value === selectedBranchId) || null}
                        onChange={(opt) => {
                          const val = (opt as any)?.value;
                          console.log('Branch selected:', val);
                          setSelectedBranchId(val);
                        }}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuShouldBlockScroll
                        placeholder="Select branch"
                      />
                    </div>
                  )}
                </div>

                {/* District selection for District Manager */}
                {formData.role === 'district_manager' && (profile?.role as string) !== 'regional_manager' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="district">District *</Label>
                      <ReactSelect
                        inputId="district"
                        classNamePrefix="rs"
                        options={districtOptions}
                        value={districtOptions.find(o => o.value === selectedDistrictId) || null}
                        onChange={(opt) => setSelectedDistrictId((opt as any)?.value || '')}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuShouldBlockScroll
                        placeholder="Select district"
                        isDisabled={!selectedRegionId}
                      />
                    </div>
                  </div>
                )}

                {/* Security and Photo Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Password field for all creators except staff */}
                  {profile?.role !== 'staff' && (
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Enter password for new user"
                      />
                      {formErrors.password && <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="photo_url">Staff Photo</Label>
                    <Input
                      id="photo_url"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${Date.now()}.${fileExt}`;
                            const filePath = `staff/${fileName}`;

                            const { error: uploadError } = await supabase.storage
                              .from('user-uploads')
                              .upload(filePath, file);

                            if (uploadError) throw uploadError;

                            const { data } = supabase.storage
                              .from('user-uploads')
                              .getPublicUrl(filePath);

                            setFormData({ ...formData, photo_url: data.publicUrl });
                          } catch (error) {
                            console.error('Error uploading photo:', error);
                            toast({
                              title: "Error",
                              description: "Failed to upload photo",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    />
                    {formData.photo_url && (
                      <div className="mt-2">
                        <img src={formData.photo_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                      </div>
                    )}
                    {formErrors.photo_url && <p className="text-sm text-red-500 mt-1">{formErrors.photo_url}</p>}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Staff Member</Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search staff members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Members ({filteredStaff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Access</TableHead>
                <TableHead>Access Count</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={staff.photo_url} alt={staff.name} />
                        <AvatarFallback>
                          {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-sm text-muted-foreground">{staff.email}</p>
                        {staff.phone && (
                          <p className="text-sm text-muted-foreground">{staff.phone}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {staff.position || <span className="text-muted-foreground italic">Not specified</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {staff.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {staff.last_access 
                      ? new Date(staff.last_access).toLocaleDateString()
                      : <span className="text-muted-foreground italic">Never</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{staff.access_count}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(staff)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {staff.user_id !== profile?.user_id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {staff.name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(staff.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredStaff.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No staff members found matching your search." : "No staff members found."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={Boolean(selectedStaff)} onOpenChange={(open) => !open && setSelectedStaff(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Full Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                  {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <Label htmlFor="edit-email">Email Address *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email address"
                    disabled={Boolean(selectedStaff)}
                  />
                  {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                  {formErrors.phone && <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor="edit-position">Position</Label>
                  <Input
                    id="edit-position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Enter job position"
                  />
                  {formErrors.position && <p className="text-sm text-red-500 mt-1">{formErrors.position}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="edit-role">Role *</Label>
                <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="assistant_manager">Assistant Manager</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="district_manager">District Manager</SelectItem>
                    <SelectItem value="regional_manager">Regional Manager</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.role && <p className="text-sm text-red-500 mt-1">{formErrors.role}</p>}
              </div>

              {/* Branch selection for roles that need it */}
              {['manager', 'assistant_manager', 'staff'].includes(formData.role) && (
                <div>
                  <Label htmlFor="edit-branch">Branch *</Label>
                  <ReactSelect
                    id="edit-branch"
                    options={branchOptions}
                    value={branchOptions.find(option => option.value === selectedBranchId) || null}
                    onChange={(option) => setSelectedBranchId(option?.value || "")}
                    placeholder="Select a branch..."
                    menuPortalTarget={document.body}
                    styles={selectStyles}
                  />
                </div>
              )}

              {/* Region selection for regional managers */}
              {formData.role === 'regional_manager' && (
                <div>
                  <Label htmlFor="edit-region">Region *</Label>
                  <ReactSelect
                    id="edit-region"
                    options={regionOptions}
                    value={regionOptions.find(option => option.value === selectedRegionId) || null}
                    onChange={(option) => setSelectedRegionId(option?.value || "")}
                    placeholder="Select a region..."
                    menuPortalTarget={document.body}
                    styles={selectStyles}
                  />
                </div>
              )}

              {/* District selection for district managers */}
              {formData.role === 'district_manager' && (
                <>
                  <div>
                    <Label htmlFor="edit-region-for-district">Region *</Label>
                    <ReactSelect
                      id="edit-region-for-district"
                      options={regionOptions}
                      value={regionOptions.find(option => option.value === selectedRegionId) || null}
                      onChange={(option) => setSelectedRegionId(option?.value || "")}
                      placeholder="Select a region..."
                      menuPortalTarget={document.body}
                      styles={selectStyles}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-district">District *</Label>
                    <ReactSelect
                      id="edit-district"
                      options={districtOptions}
                      value={districtOptions.find(option => option.value === selectedDistrictId) || null}
                      onChange={(option) => setSelectedDistrictId(option?.value || "")}
                      placeholder="Select a district..."
                      isDisabled={!selectedRegionId}
                      menuPortalTarget={document.body}
                      styles={selectStyles}
                    />
                  </div>
                </>
              )}

              {selectedStaff && (
                <div>
                  <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter new password (optional)"
                  />
                  {formErrors.password && <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>}
                </div>
              )}

              <div>
                <Label htmlFor="edit-photo_url">Staff Photo</Label>
                <Input
                  id="edit-photo_url"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}.${fileExt}`;
                        const filePath = `staff/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                          .from('user-uploads')
                          .upload(filePath, file);

                        if (uploadError) throw uploadError;

                        const { data } = supabase.storage
                          .from('user-uploads')
                          .getPublicUrl(filePath);

                        setFormData({ ...formData, photo_url: data.publicUrl });
                      } catch (error) {
                        console.error('Error uploading photo:', error);
                        toast({
                          title: "Error",
                          description: "Failed to upload photo",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                />
                {formData.photo_url && (
                  <div className="mt-2">
                    <img src={formData.photo_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  </div>
                )}
                {formErrors.photo_url && <p className="text-sm text-red-500 mt-1">{formErrors.photo_url}</p>}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setSelectedStaff(null)}>
                  Cancel
                </Button>
                <Button type="submit">Update Staff Member</Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Staff;