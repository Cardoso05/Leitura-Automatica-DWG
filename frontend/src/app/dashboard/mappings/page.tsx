"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Loader2, Package, Lock } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import {
  listBlockMappings,
  createBlockMapping,
  deleteBlockMapping,
  BlockMapping,
} from "@/lib/api-client";
import { Discipline } from "@/lib/types";

const disciplineOptions: { value: Discipline; label: string }[] = [
  { value: "electrical", label: "Elétrica" },
  { value: "plumbing", label: "Hidráulica" },
  { value: "networking", label: "Rede/Dados" },
  { value: "hvac", label: "HVAC" },
  { value: "fire", label: "Incêndio" },
  { value: "spda", label: "SPDA" },
  { value: "generic", label: "Outros" },
];

export default function MappingsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    block_name_pattern: "",
    material_description: "",
    unit: "un",
    discipline: "electrical" as Discipline,
    is_material: true,
    use_regex: false,
    category: "",
  });

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["block-mappings", token],
    queryFn: () => listBlockMappings(token as string),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      createBlockMapping(
        {
          ...data,
          category: data.category || null,
        },
        token as string
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block-mappings"] });
      toast.success("Mapeamento criado com sucesso!");
      setShowForm(false);
      setFormData({
        block_name_pattern: "",
        material_description: "",
        unit: "un",
        discipline: "electrical",
        is_material: true,
        use_regex: false,
        category: "",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao criar mapeamento");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBlockMapping(id, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["block-mappings"] });
      toast.success("Mapeamento removido!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao remover");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.block_name_pattern || !formData.material_description) {
      toast.error("Preencha o padrão do bloco e a descrição");
      return;
    }
    createMutation.mutate(formData);
  };

  const userMappings = mappings?.filter((m) => m.user_id !== null) || [];
  const defaultMappings = mappings?.filter((m) => m.user_id === null) || [];

  if (!token) {
    return (
      <DashboardShell>
        <p className="text-sm text-text-muted">Faça login para gerenciar mapeamentos.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-blueprint-800 tracking-[-0.02em]">
              Mapeamento de Blocos
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Configure como os blocos DWG são traduzidos para descrições de materiais.
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Mapeamento
          </Button>
        </div>

        {showForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-text-primary mb-1.5 block">
                    Padrão do Bloco *
                  </label>
                  <Input
                    placeholder="Ex: TRF*, POT1, L-*X*"
                    value={formData.block_name_pattern}
                    onChange={(e) =>
                      setFormData({ ...formData, block_name_pattern: e.target.value })
                    }
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Use * como coringa (ex: TRF* casa TRF1000, TRF1500, etc.)
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary mb-1.5 block">
                    Descrição do Material *
                  </label>
                  <Input
                    placeholder="Ex: Transformador a seco"
                    value={formData.material_description}
                    onChange={(e) =>
                      setFormData({ ...formData, material_description: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-text-primary mb-1.5 block">
                    Disciplina
                  </label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-grid-line bg-white text-sm"
                    value={formData.discipline}
                    onChange={(e) =>
                      setFormData({ ...formData, discipline: e.target.value as Discipline })
                    }
                  >
                    {disciplineOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary mb-1.5 block">
                    Unidade
                  </label>
                  <Input
                    placeholder="un"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary mb-1.5 block">
                    Categoria
                  </label>
                  <Input
                    placeholder="Ex: transformador, luminária"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.is_material}
                    onChange={(e) =>
                      setFormData({ ...formData, is_material: e.target.checked })
                    }
                    className="rounded"
                  />
                  É material (aparece no orçamento)
                </label>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Salvar Mapeamento
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-electric" />
          </div>
        ) : (
          <>
            {userMappings.length > 0 && (
              <Card title="Seus Mapeamentos">
                <div className="space-y-2">
                  {userMappings.map((mapping) => (
                    <MappingRow
                      key={mapping.id}
                      mapping={mapping}
                      onDelete={() => deleteMutation.mutate(mapping.id)}
                      canDelete
                    />
                  ))}
                </div>
              </Card>
            )}

            <Card title="Mapeamentos Padrão">
              <p className="text-xs text-text-muted mb-4">
                Mapeamentos globais incluídos no sistema. Não podem ser editados ou removidos.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {defaultMappings.map((mapping) => (
                  <MappingRow key={mapping.id} mapping={mapping} canDelete={false} />
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function MappingRow({
  mapping,
  onDelete,
  canDelete,
}: {
  mapping: BlockMapping;
  onDelete?: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-blueprint-50/50 transition-colors border border-transparent hover:border-grid-line">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Package className="h-4 w-4 text-text-muted shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-blueprint-800 bg-blueprint-50 px-1.5 py-0.5 rounded">
              {mapping.block_name_pattern}
            </code>
            <span className="text-text-muted">→</span>
            <span className="text-sm text-text-primary truncate">
              {mapping.material_description}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone={mapping.discipline} variant="discipline" label={mapping.discipline} />
            <span className="text-xs text-text-muted">{mapping.unit}</span>
            {mapping.category && (
              <span className="text-xs text-text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                {mapping.category}
              </span>
            )}
            {!mapping.is_material && (
              <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                não-material
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {mapping.is_default && (
          <span title="Mapeamento padrão">
            <Lock className="h-4 w-4 text-text-muted" />
          </span>
        )}
        {canDelete && onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-red-600 transition-colors"
            title="Remover mapeamento"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
