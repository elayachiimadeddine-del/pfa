const Generator = require('yeoman-generator').default;

module.exports = class extends Generator {
  // 1. Interaction avec l'utilisateur
  async prompting() {
    this.log("--- 🚀 Générateur de Lab Réseau NetDevOps ENSAO 🚀 ---");

    this.answers = await this.prompt([
      {
        type: "input",
        name: "project_name",
        message: "Nom du projet (ex: pfa-ensao) :",
        default: "pfa-ensao"
      },
      {
        type: "input",
        name: "ceos_image",
        message: "Nom de l'image Docker cEOS détectée :",
        default: "ceos:4.36.0F"
      },
      {
        type: "input",
        name: "admin_user",
        message: "Utilisateur admin réseau :",
        default: "admin"
      },
      {
        type: "password",
        name: "admin_password",
        message: "Mot de passe admin réseau :",
        default: "admin123"
      },
      {
        type: "input",
        name: "vlan_id",
        message: "ID du VLAN à configurer (ex: 10, 20) :",
        default: "10"
      }
    ]);
  }

  // 2. Écriture des fichiers de configuration
  writing() {
    this.log("🛠️ Génération des fichiers d'infrastructure...");

    // --- 1. Topologie Containerlab ---
    const clabTemplate = `
name: ${this.answers.project_name}
topology:
  nodes:
    router_admin:
      kind: ceos
      image: ${this.answers.ceos_image}
      mgmt-ipv4: 172.20.20.10
    switch_a:
      kind: ceos
      image: ${this.answers.ceos_image}
      mgmt-ipv4: 172.20.20.11
    switch_b:
      kind: ceos
      image: ${this.answers.ceos_image}
      mgmt-ipv4: 172.20.20.12

  links:
    - endpoints: ["router_admin:eth1", "switch_a:eth1"]
    - endpoints: ["router_admin:eth2", "switch_b:eth1"]
`;

    // --- 2. Inventaire Ansible (Correction SSH incluse) ---
    const ansibleInventory = `
all:
  hosts:
    router_admin: { ansible_host: 172.20.20.10 }
    switch_a: { ansible_host: 172.20.20.11 }
    switch_b: { ansible_host: 172.20.20.12 }
  vars:
    ansible_network_os: arista.eos.eos
    ansible_connection: network_cli
    ansible_user: ${this.answers.admin_user}
    ansible_password: ${this.answers.admin_password}
    ansible_become: yes
    ansible_become_method: enable
    ansible_become_password: ${this.answers.admin_password}
    # Force keyboard-interactive pour éviter l'erreur d'authentification Arista
    ansible_ssh_common_args: '-o StrictHostKeyChecking=no -o PreferredAuthentications=keyboard-interactive'
`;

    // --- 3. Playbook de configuration automatique ---
    const ansiblePlaybook = `
---
- name: Configuration Day-1 du réseau ENSAO
  hosts: all
  gather_facts: no
  tasks:
    - name: Configurer le Hostname
      arista.eos.eos_hostname:
        hostname: "{{ inventory_hostname }}"

    - name: Créer le VLAN de production
      arista.eos.eos_vlans:
        config:
          - vlan_id: ${this.answers.vlan_id}
            name: VLAN_PFA_PROD

    - name: Activer les interfaces de liaison
      arista.eos.eos_l1_interface:
        name: Ethernet1
        enabled: true
`;

    // Écriture effective des fichiers
    this.writeDestination("topology.clab.yml", clabTemplate.trim());
    this.writeDestination("hosts.yml", ansibleInventory.trim());
    this.writeDestination("configure_network.yml", ansiblePlaybook.trim());
  }

  // 3. Instructions de fin
  end() {
    this.log("\n✅ PROJET GÉNÉRÉ AVEC SUCCÈS !");
    this.log("--------------------------------------------------");
    this.log("1. Déployer le lab :");
    this.log("   sudo containerlab deploy -t topology.clab.yml");
    this.log("\n2. IMPORTANT : Configurer l'accès AAA sur les switches (si pas encore fait) :");
    this.log("   docker exec -it clab-${this.answers.project_name}-router_admin Cli");
    this.log("   (puis: conf t -> username admin secret admin123 -> aaa authentication login default local)");
    this.log("\n3. Lancer l'automatisation Ansible :");
    this.log("   export ANSIBLE_HOST_KEY_CHECKING=False");
    this.log("   ansible-playbook -i hosts.yml configure_network.yml");
    this.log("--------------------------------------------------");
  }
};
